#!/usr/bin/env python3
"""
Fetches WebUntis student timetable and writes an ICS file.
Uses the internal REST API that the web UI calls.
"""

import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

# --- config from env / secrets ---
SCHOOL = os.environ.get("WEBUNTIS_SCHOOL", "bbsgut")
USERNAME = os.environ["WEBUNTIS_USERNAME"]
PASSWORD = os.environ["WEBUNTIS_PASSWORD"]
BASE = f"https://{SCHOOL}.webuntis.com"
HOST = f"{SCHOOL}.webuntis.com"

# how many days back / forward
DAYS_BACK = 21
DAYS_FORWARD = 21

TZ = ZoneInfo("Europe/Berlin")


def login(session: requests.Session) -> str:
    """Perform login and return Bearer JWT."""
    r = session.get(f"{BASE}/WebUntis/?school={SCHOOL}", timeout=30)
    r.raise_for_status()

    csrf = None
    m = re.search(r'name="_csrf"\s+value="([^"]+)"', r.text)
    if m:
        csrf = m.group(1)

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": BASE,
        "Referer": f"{BASE}/WebUntis/?school={SCHOOL}",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    if csrf:
        headers["X-CSRF-TOKEN"] = csrf

    data = {
        "school": SCHOOL,
        "j_username": USERNAME,
        "j_password": PASSWORD,
        "token": "",
    }
    if csrf:
        data["_csrf"] = csrf

    r = session.post(
        f"{BASE}/WebUntis/j_spring_security_check",
        data=data,
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    body = r.json()
    if body.get("state") != "SUCCESS":
        raise RuntimeError(f"Login failed: {body}")

    r = session.get(f"{BASE}/WebUntis/api/token/new", timeout=30)
    r.raise_for_status()
    token = r.text.strip().strip('"')
    if not token.startswith("eyJ"):
        raise RuntimeError("Did not receive a JWT")
    return token


def get_person_id(token: str) -> int:
    import base64
    import json

    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload))
    return int(data["person_id"])


def fetch_entries(session: requests.Session, token: str, person_id: int, start: str, end: str) -> dict:
    url = (
        f"{BASE}/WebUntis/api/rest/view/v1/timetable/entries"
        f"?start={start}&end={end}"
        f"&format=1&resourceType=STUDENT&resources={person_id}"
        f"&periodTypes=&timetableType=MY_TIMETABLE&layout=START_TIME"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    r = session.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def format_dt(iso_local: str) -> str:
    """'2026-11-12T08:00' → 20261112T080000 (Apple needs seconds)"""
    cleaned = iso_local.replace("-", "").replace(":", "")
    if len(cleaned) == 13:  # YYYYMMDDTHHMM
        cleaned += "00"
    return cleaned


def build_ics(days: list) -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//WebUntis-ICS//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:» 🏫 BBS-GuT • Stundenplan",
        "X-WR-TIMEZONE:Europe/Berlin",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Berlin",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]

    for day in days:
        for entry in day.get("gridEntries") or []:
            start = entry["duration"]["start"]
            end = entry["duration"]["end"]

            def pos(n, key="longName"):
                p = entry.get(f"position{n}")
                if not p:
                    return ""
                cur = p[0].get("current") or {}
                return cur.get(key) or cur.get("shortName") or ""

            teacher = pos(1)
            subject = pos(2, "shortName") or pos(2)
            room = pos(3, "shortName") or pos(3)
            room_long = pos(3)

            notes = (entry.get("notesAll") or "").strip()
            lesson_text = (entry.get("lessonText") or "").strip()
            lesson_info = entry.get("lessonInfo")
            if isinstance(lesson_info, dict):
                lesson_info = str(lesson_info)
            else:
                lesson_info = (lesson_info or "").strip()

            texts = []
            for t in entry.get("texts") or []:
                if isinstance(t, dict):
                    texts.append(t.get("text") or t.get("value") or str(t))
                else:
                    texts.append(str(t))

            extra = []
            if teacher:
                extra.append(teacher)
            if lesson_text:
                extra.append(f"Lehrstoff: {lesson_text}")
            if notes:
                extra.append(f"Notiz: {notes}")
            if lesson_info:
                extra.append(str(lesson_info))
            if texts:
                extra.append(" / ".join(texts))

            description = "\n".join(extra)
            summary = subject or "Unterricht"
            location = room_long or room

            uid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{start}-{end}-{subject}-{room}-{teacher}"))

            lines += [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now}",
                f"DTSTART;TZID=Europe/Berlin:{format_dt(start)}",
                f"DTEND;TZID=Europe/Berlin:{format_dt(end)}",
                f"SUMMARY:{_escape(summary)}",
                f"LOCATION:{_escape(location)}",
                f"DESCRIPTION:{_escape(description)}",
                "END:VEVENT",
            ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def main():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; WebUntis-ICS/1.0)",
            "Accept-Language": "de-DE,de;q=0.9",
        }
    )

    print("Logging in …")
    token = login(session)
    person_id = get_person_id(token)
    print(f"person_id = {person_id}")

    today = datetime.now(TZ).date()
    start = (today - timedelta(days=DAYS_BACK)).isoformat()
    end = (today + timedelta(days=DAYS_FORWARD)).isoformat()
    print(f"Fetching {start} → {end}")

    data = fetch_entries(session, token, person_id, start, end)
    days = data.get("days") or []
    total = sum(len(d.get("gridEntries") or []) for d in days)
    print(f"Got {total} periods across {len(days)} days")

    ics = build_ics(days)
    out = os.environ.get("ICS_PATH", "assets/bbs.ics")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(ics)
    print(f"Wrote {out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)