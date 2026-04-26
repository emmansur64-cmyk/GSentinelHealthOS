"""Resolvedor de fechas y horas relativas para el Brain."""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, time, timedelta
from typing import Any


class DateResolver:
    """Convierte lenguaje natural simple en fecha/hora concretas."""

    MONTHS = {
        "enero": 1,
        "febrero": 2,
        "marzo": 3,
        "abril": 4,
        "mayo": 5,
        "junio": 6,
        "julio": 7,
        "agosto": 8,
        "septiembre": 9,
        "setiembre": 9,
        "octubre": 10,
        "noviembre": 11,
        "diciembre": 12,
    }

    WEEKDAYS = {
        "lunes": 0,
        "martes": 1,
        "miercoles": 2,
        "jueves": 3,
        "viernes": 4,
        "sabado": 5,
        "domingo": 6,
    }

    DATE_SLASH_PATTERN = re.compile(
        r"\b(?P<day>\d{1,2})/(?P<month>\d{1,2})(?:/(?P<year>\d{2,4}))?\b"
    )
    DATE_TEXT_PATTERN = re.compile(
        r"\b(?P<day>\d{1,2})\s+de\s+(?P<month>[a-zA-Záéíóúñ]+)(?:\s+de\s+(?P<year>\d{4}))?\b"
    )
    CLOCK_PATTERN = re.compile(
        r"\b(?P<hour>[01]?\d|2[0-3]):(?P<minute>[0-5]\d)(?:\s*(?P<meridiem>am|pm))?\b"
    )
    HOUR_PATTERN = re.compile(
        r"(?:a\s+las?\s+)?(?P<hour>1[0-2]|0?\d|2[0-3])(?:\s*(?P<meridiem>am|pm))?(?:\s*(?:hs?|horas?))?\b"
    )

    @staticmethod
    def normalize(text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text.lower())
        return "".join(char for char in normalized if not unicodedata.combining(char))

    @classmethod
    def resolve(
        cls,
        text: str,
        reference_datetime: datetime | None = None,
    ) -> dict[str, Any]:
        normalized = cls.normalize(text)
        reference = reference_datetime or datetime.utcnow()
        appointment_date, date_hint, ambiguous_date = cls._extract_date(normalized, reference)
        appointment_time, time_hint = cls._extract_time(normalized)

        appointment_at = None
        if appointment_date is not None and appointment_time is not None:
            appointment_at = datetime.combine(appointment_date, appointment_time)

        return {
            "date_hint": date_hint,
            "time_hint": time_hint,
            "appointment_date": appointment_date.isoformat() if appointment_date else None,
            "appointment_time": appointment_time.isoformat() if appointment_time else None,
            "appointment_at": appointment_at,
            "ambiguous_date": ambiguous_date,
            "missing_time": appointment_date is not None and appointment_time is None,
        }

    @classmethod
    def _extract_date(
        cls,
        normalized_text: str,
        reference_datetime: datetime,
    ) -> tuple[date | None, str | None, bool]:
        today = reference_datetime.date()

        slash_match = cls.DATE_SLASH_PATTERN.search(normalized_text)
        if slash_match:
            day = int(slash_match.group("day"))
            month = int(slash_match.group("month"))
            raw_year = slash_match.group("year")
            year = today.year if raw_year is None else int(raw_year)
            if raw_year and len(raw_year) == 2:
                year += 2000
            parsed = cls._safe_date(year, month, day)
            if parsed is not None:
                if raw_year is None and parsed < today:
                    parsed = cls._safe_date(year + 1, month, day)
                return parsed, slash_match.group(0), False

        text_match = cls.DATE_TEXT_PATTERN.search(normalized_text)
        if text_match:
            day = int(text_match.group("day"))
            month = cls.MONTHS.get(text_match.group("month"))
            if month is not None:
                raw_year = text_match.group("year")
                year = today.year if raw_year is None else int(raw_year)
                parsed = cls._safe_date(year, month, day)
                if parsed is not None:
                    if raw_year is None and parsed < today:
                        parsed = cls._safe_date(year + 1, month, day)
                    return parsed, text_match.group(0), False

        if "pasado manana" in normalized_text:
            return today + timedelta(days=2), "pasado manana", False
        if "manana" in normalized_text:
            return today + timedelta(days=1), "manana", False
        if "hoy" in normalized_text:
            return today, "hoy", False

        for weekday_name, weekday_index in cls.WEEKDAYS.items():
            if weekday_name not in normalized_text:
                continue

            qualifier = cls._weekday_qualifier(normalized_text, weekday_name)
            parsed = cls._resolve_weekday(today, weekday_index, qualifier)
            ambiguous = qualifier == "implicit"
            return parsed, weekday_name, ambiguous

        return None, None, False

    @classmethod
    def _extract_time(cls, normalized_text: str) -> tuple[time | None, str | None]:
        clock_match = cls.CLOCK_PATTERN.search(normalized_text)
        if clock_match:
            hour = int(clock_match.group("hour"))
            meridiem = clock_match.group("meridiem")
            hour = cls._apply_meridiem(hour, meridiem, normalized_text)
            parsed = time(hour=hour, minute=int(clock_match.group("minute")))
            return parsed, clock_match.group(0)

        if "mediodia" in normalized_text:
            return time(hour=12, minute=0), "mediodia"
        if "medianoche" in normalized_text:
            return time(hour=0, minute=0), "medianoche"

        hour_match = cls.HOUR_PATTERN.search(normalized_text)
        if hour_match:
            hour = int(hour_match.group("hour"))
            meridiem = hour_match.group("meridiem")
            hour = cls._apply_meridiem(hour, meridiem, normalized_text)
            return time(hour=hour, minute=0), hour_match.group(0)

        return None, None

    @classmethod
    def _apply_meridiem(cls, hour: int, meridiem: str | None, normalized_text: str) -> int:
        if meridiem == "pm" and hour < 12:
            return hour + 12
        if meridiem == "am" and hour == 12:
            return 0
        if "de la tarde" in normalized_text or "de la noche" in normalized_text:
            return hour + 12 if hour < 12 else hour
        if "de la manana" in normalized_text and hour == 12:
            return 0
        return hour

    @staticmethod
    def _weekday_qualifier(normalized_text: str, weekday_name: str) -> str:
        if f"proximo {weekday_name}" in normalized_text or f"el proximo {weekday_name}" in normalized_text:
            return "next"
        if f"este {weekday_name}" in normalized_text or f"el este {weekday_name}" in normalized_text:
            return "this"
        return "implicit"

    @staticmethod
    def _resolve_weekday(today: date, weekday_index: int, qualifier: str) -> date:
        delta = (weekday_index - today.weekday()) % 7
        if qualifier == "next":
            delta = delta + 7 if delta != 0 else 7
        elif delta == 0:
            delta = 7
        return today + timedelta(days=delta)

    @staticmethod
    def _safe_date(year: int, month: int, day: int) -> date | None:
        try:
            return date(year, month, day)
        except ValueError:
            return None