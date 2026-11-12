#!/usr/bin/env python3
"""
Fetches WebUntis student timetable and writes an ICS file.
Uses the internal REST API that the web UI calls.
Additionally fetches per-period detail (teachingContent, exam, homework).
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

DAYS_BACK = 28
DAYS_FORWARD = 21

TZ = ZoneInfo("Europe/Berlin")

SUBJECT_MAP = {
    "BBU_Fahr": "Fahrzeugtechnik",
    "ReEt": "Ethik",
}


def login(session: requests.Session) -> str:
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


def get_schoolyear_id(session: requests.Session, token: str) -> int:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    r = session.get(f"{BASE}/WebUntis/api/rest/view/v1/schoolyears", headers=headers, timeout=30)
    r.raise_for_status()
    years = r.json()
    today = datetime.now(TZ).date().isoformat()
    for y in years:
        dr = y.get("dateRange") or {}
        if dr.get("start", "") <= today <= dr.get("end", "9999"):
            return int(y["id"])
    return int(years[0]["id"])


def fetch_entries(session: requests.Session, token: str, person_id: int, start: str, end: str) -> dict:
    url = (
        f"{BASE}/WebUntis/api/rest/view/v1/timetable/entries"
        f"?start={start}&end={end}"
        f"&format=1&resourceType=STUDENT&resources={person_id}"
        f"&periodTypes=&timetableType=MY_TIMETABLE&layout=START_TIME"
    )
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    r = session.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_detail(
    session: requests.Session,
    token: str,
    person_id: int,
    schoolyear_id: int,
    start: str,
    end: str,
):
    """Fetch teachingContent / exam / homework for one period."""
    if len(start) == 16:
        start = start + ":00"
    if len(end) == 16:
        end = end + ":00"

    url = (
        f"{BASE}/WebUntis/api/rest/view/v2/calendar-entry/detail"
        f"?elementId={person_id}&elementType=5"
        f"&startDateTime={start}&endDateTime={end}"
        f"&homeworkOption=DUE"
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "x-webuntis-api-school-year-id": str(schoolyear_id),
        "tenant-id": "2580700",
    }
    try:
        r = session.get(url, headers=headers, timeout=20)
        if r.status_code != 200:
            return None
        data = r.json()
        entries = data.get("calendarEntries") or []
        return entries[0] if entries else None
    except Exception:
        return None


def format_dt(iso_local: str) -> str:
    cleaned = iso_local.replace("-", "").replace(":", "")
    if len(cleaned) == 13:
        cleaned += "00"
    return cleaned


def is_cancelled(entry: dict, detail) -> bool:
    status = (entry.get("status") or "").upper()
    if status in ("CANCELLED", "CANCELED", "DELETED", "ABSENT"):
        return True
    if detail and (detail.get("status") or "").upper() in ("CANCELLED", "CANCELED", "DELETED"):
        return True
    detail_status = (entry.get("statusDetail") or "").upper()
    if "CANCEL" in detail_status or "ENTFALL" in detail_status:
        return True
    sub = (entry.get("substitutionText") or "").lower()
    if "entfällt" in sub or "entfall" in sub:
        return True
    return False


def is_exam(entry: dict, detail) -> bool:
    if (entry.get("type") or "").upper() == "EXAM":
        return True
    if detail and detail.get("exam"):
        return True
    for t in entry.get("texts") or []:
        if isinstance(t, dict) and t.get("type") == "LESSON_INFO":
            txt = (t.get("text") or "").lower()
            if "klassenarbeit" in txt or "klausur" in txt or "prüfung" in txt:
                return True
    return False


def build_ics(days: list, details: dict) -> str:
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
            detail = details.get((start, end))

            def pos(n, key="longName"):
                p = entry.get(f"position{n}")
                if not p:
                    return ""
                cur = p[0].get("current") or {}
                return cur.get(key) or cur.get("shortName") or ""

            teacher_long = pos(1, "longName")
            teacher_short = pos(1, "shortName")
            subject_raw = pos(2, "shortName") or pos(2, "longName")
            room_short = pos(3, "shortName")
            room_long = pos(3, "longName")

            if detail:
                if detail.get("teachers"):
                    t = detail["teachers"][0]
                    teacher_long = t.get("longName") or teacher_long
                    teacher_short = t.get("shortName") or teacher_short
                if detail.get("rooms"):
                    r = detail["rooms"][0]
                    room_short = r.get("shortName") or room_short
                    room_long = r.get("longName") or room_long
                if detail.get("subject"):
                    subject_raw = detail["subject"].get("shortName") or subject_raw

            subject = SUBJECT_MAP.get(subject_raw, subject_raw)
            cancelled = is_cancelled(entry, detail)
            exam = is_exam(entry, detail)

            # title
            if cancelled:
                summary = f"❌ {subject}"
            elif exam:
                summary = f"📝 {subject}"
            else:
                summary = subject

            # location
            teacher_part = teacher_long or teacher_short
            if cancelled:
                location = "- ENTFÄLLT -"
            elif exam:
                location = f"KLASSENARBEIT | {room_short}"
                if teacher_part:
                    location += f" • {teacher_part}"
            else:
                location = room_short or ""
                if teacher_part:
                    location = f"{location} • {teacher_part}" if location else teacher_part

            # description
            desc_lines = []
            if room_long and not cancelled:
                desc_lines.append(f"Rauminfo: {room_long}")
            if teacher_long or teacher_short:
                if teacher_long and teacher_short and teacher_long != teacher_short:
                    desc_lines.append(f"Lehrer: {teacher_long} ({teacher_short})")
                else:
                    desc_lines.append(f"Lehrer: {teacher_long or teacher_short}")

            teaching = ""
            if detail and detail.get("teachingContent"):
                teaching = detail["teachingContent"].strip()
            if not teaching:
                teaching = (entry.get("lessonText") or "").strip()
            if teaching:
                desc_lines.append(f"Lehrstoff: {teaching}")

            homework_parts = []
            if detail and detail.get("homeworks"):
                for hw in detail["homeworks"]:
                    txt = hw.get("text") or hw.get("title") or str(hw)
                    if txt:
                        homework_parts.append(txt)
            notes = (entry.get("notesAll") or "").strip()
            if notes:
                homework_parts.append(notes)
            if homework_parts:
                desc_lines.append("Hausaufgaben: " + " / ".join(homework_parts))

            if exam and not cancelled:
                for t in entry.get("texts") or []:
                    if isinstance(t, dict) and t.get("text"):
                        desc_lines.append(t["text"])

            description = "\n".join(desc_lines)

            uid = str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"{start}-{end}-{subject_raw}-{room_short}-{teacher_short}",
                )
            )

            lines += [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now}",
                f"DTSTART;TZID=Europe/Berlin:{format_dt(start)}",
                f"DTEND;TZID=Europe/Berlin:{format_dt(end)}",
                f"SUMMARY:{_escape(summary)}",
                f"LOCATION:{_escape(location)}",
                f"DESCRIPTION:{_escape(description)}",
            ]

            lines += [
                "BEGIN:VALARM",
                "TRIGGER:-PT15M",
                "ACTION:DISPLAY",
                f"DESCRIPTION:{_escape(summary)}",
                "END:VALARM",
            ]

            if exam or cancelled:
                lines += [
                    "BEGIN:VALARM",
                    "TRIGGER:-P1D",
                    "ACTION:DISPLAY",
                    f"DESCRIPTION:{_escape(summary)}",
                    "END:VALARM",
                ]

            lines.append("END:VEVENT")

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

    schoolyear_id = get_schoolyear_id(session, token)
    print(f"schoolyear_id = {schoolyear_id}")

    today = datetime.now(TZ).date()
    start = (today - timedelta(days=DAYS_BACK)).isoformat()
    end = (today + timedelta(days=DAYS_FORWARD)).isoformat()
    print(f"Fetching timetable {start} → {end}")

    data = fetch_entries(session, token, person_id, start, end)
    days = data.get("days") or []
    total = sum(len(d.get("gridEntries") or []) for d in days)
    print(f"Got {total} periods – fetching details …")

    details = {}
    for day in days:
        for entry in day.get("gridEntries") or []:
            s = entry["duration"]["start"]
            e = entry["duration"]["end"]
            detail = fetch_detail(session, token, person_id, schoolyear_id, s, e)
            if detail:
                details[(s, e)] = detail
                tc = (detail.get("teachingContent") or "")[:60]
                if tc:
                    print(f"  {s}: teachingContent={tc!r}")

    print(f"Details loaded for {len(details)} periods")

    ics = build_ics(days, details)
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