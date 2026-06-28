"""Change-window check — pure (the caller passes `now`).

A change window is an approved maintenance interval. Whether a window is
*required* is a caller decision (see Settings.require_change_window); this module
only answers "is `now` inside this window?" given the window dict and the clock.
"""

from __future__ import annotations

from datetime import datetime


def in_window(window: dict | None, now: datetime) -> tuple[bool, str]:
    """Return (ok, reason) for whether `now` falls within `window`.

    `window` is {"start": iso, "end": iso} or None. When None, returns
    (True, "no window set") — the caller decides whether a window is required.
    """
    if window is None:
        return True, "no window set"

    try:
        start = datetime.fromisoformat(window["start"])
        end = datetime.fromisoformat(window["end"])
    except (KeyError, TypeError, ValueError) as exc:
        return False, f"invalid change window: {exc}"

    if start <= now <= end:
        return True, f"within change window {window['start']}..{window['end']}"
    return False, f"outside change window {window['start']}..{window['end']} (now={now.isoformat()})"
