#!/usr/bin/env python3
"""
Fetches Serrig Orts-App event calendar and writes an ICS file.
Uses the public eventList endpoint and enriches each entry with detail data.
"""

import os
import re
import sys
from datetime import datetime, timedelta, timezone
from html import unescape
from zoneinfo import ZoneInfo

import requests

API_BASE = (
    "https://serrig.orts.app/api/W2U/"
    "BA4639B6-DE43-4DB7-BADB-9ED74A823DC4"
)
LIST_URL = f"{API_BASE}/eventcalendar/eventList"
DETAIL_URL = f"{API_BASE}/eventcalendar/{{master_id}}?forEdit=false"

TZ = ZoneInfo("Europe/Berlin")
DEFAULT_DURATION = timedelta(hours=1)  # when end is missing / open-end


def strip_html(html: str | None) -> str:
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.I)
    text = re.sub(r"</li\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def parse_list_dt(s: str) -> datetime:
    """List API returns naive local times (Europe/Berlin)."""
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(TZ)
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


def parse_detail_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(TZ)
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


def format_dt(dt: datetime, all_day: bool = False) -> str:
    if all_day:
        return dt.strftime("%Y%m%d")
    return dt.strftime("%Y%m%dT%H%M%S")


def fetch_list(session: requests.Session) -> list[dict]:
    r = session.get(LIST_URL, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_detail(session: requests.Session, master_id: str) -> dict | None:
    try:
        r = session.get(DETAIL_URL.format(master_id=master_id), timeout=20)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None


def build_event(list_item: dict, detail: dict | None) -> dict:
    title = (detail or {}).get("summary") or list_item.get("title") or "Termin"
    location = (
        (detail or {}).get("category")
        or list_item.get("overline")
        or ""
    )
    body_html = (
        (detail or {}).get("htmlDescription")
        or list_item.get("body")
        or ""
    )
    description = strip_html(body_html)

    image = None
    if detail and detail.get("coverImage"):
        image = (detail["coverImage"] or {}).get("assetImageUrl")
    if not image:
        image = list_item.get("imageUri")

    # always trust list times for the occurrence (series expand correctly there)
    start = parse_list_dt(list_item["start"])
    end_raw = list_item.get("end")
    end = parse_list_dt(end_raw) if end_raw else None

    is_all_day = False
    is_open_end = False

    # detail only for flags / better description – not for series start/end
    if detail and not list_item.get("isSeries"):
        d_start = parse_detail_dt(detail.get("start"))
        d_end = parse_detail_dt(detail.get("end"))
        # only adopt detail times when they land on the same calendar day
        if d_start and d_start.date() == start.date():
            start = d_start
        if d_end and (not end or d_end.date() == end.date()):
            end = d_end
        is_all_day = bool(detail.get("isAllDay"))
        is_open_end = bool(detail.get("isOpenEnd"))

    # list heuristic for all-day
    if (
        list_item.get("start", "").endswith("T00:00:00")
        and (not end_raw or end_raw.endswith("T00:00:00"))
        and start.hour == 0
        and start.minute == 0
    ):
        is_all_day = True

    if is_all_day:
        # ICS all-day: DTEND is exclusive next day
        if not end or end.date() <= start.date():
            end = start + timedelta(days=1)
        else:
            end = end + timedelta(days=1)
        is_open_end = False
    else:
        if not end or end <= start:
            end = start + DEFAULT_DURATION
            is_open_end = True
        else:
            # we have a real end from the list – ignore detail's open-end flag
            is_open_end = False

    # unique UID per occurrence (id differs even for series)
    uid = list_item.get("id") or list_item.get("masterId")
    target = list_item.get("targetUri") or ""
    url = f"https://serrig.orts.app/{target}" if target else ""

    return {
        "uid": uid,
        "title": title,
        "location": location,
        "description": description,
        "start": start,
        "end": end,
        "all_day": is_all_day,
        "open_end": is_open_end,
        "image": image,
        "url": url,
    }


def build_ics(events: list[dict]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Serrig-OrtsApp-ICS//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:» 🏡 Serrig",
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

    for ev in events:
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{ev['uid']}@serrig.orts.app")
        lines.append(f"DTSTAMP:{now}")

        if ev["all_day"]:
            lines.append(f"DTSTART;VALUE=DATE:{format_dt(ev['start'], True)}")
            lines.append(f"DTEND;VALUE=DATE:{format_dt(ev['end'], True)}")
        else:
            lines.append(
                f"DTSTART;TZID=Europe/Berlin:{format_dt(ev['start'])}"
            )
            lines.append(f"DTEND;TZID=Europe/Berlin:{format_dt(ev['end'])}")

        lines.append(f"SUMMARY:{_escape(ev['title'])}")

        if ev["location"]:
            lines.append(f"LOCATION:{_escape(ev['location'])}")

        desc_parts = []
        if ev["description"]:
            desc_parts.append(ev["description"])
        if ev["open_end"] and not ev["all_day"]:
            desc_parts.append("(Ende offen / geschätzt)")
        if ev["url"]:
            desc_parts.append(f"Mehr Infos: {ev['url']}")
        if desc_parts:
            lines.append(f"DESCRIPTION:{_escape(chr(10).join(desc_parts))}")

        if ev["url"]:
            lines.append(f"URL:{ev['url']}")

        if ev["image"]:
            # Apple / many clients pick up ATTACH for images
            lines.append(f"ATTACH;FMTTYPE=image/jpeg:{ev['image']}")
            # also expose as X-property for clients that support it
            lines.append(f"X-IMAGE-URL:{ev['image']}")

        lines += [
            "BEGIN:VALARM",
            "TRIGGER:-PT1H",
            "ACTION:DISPLAY",
            f"DESCRIPTION:{_escape(ev['title'])}",
            "END:VALARM",
        ]
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def main():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; Serrig-ICS/1.0)",
            "Accept": "application/json",
            "Accept-Language": "de-DE,de;q=0.9",
        }
    )

    print("Fetching event list …")
    raw = fetch_list(session)
    print(f"Got {len(raw)} events – enriching details …")

    events = []
    for item in raw:
        mid = item.get("masterId") or item.get("id")
        detail = fetch_detail(session, mid) if mid else None
        ev = build_event(item, detail)
        events.append(ev)
        tag = "all-day" if ev["all_day"] else "timed"
        print(f"  {ev['start'].date()}  {ev['title'][:50]!r}  ({tag})")

    # chronological
    events.sort(key=lambda e: e["start"])

    ics = build_ics(events)
    out = os.environ.get("ICS_PATH", "assets/serrig.ics")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(ics)
    print(f"Wrote {len(events)} events → {out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)