#!/usr/bin/env python3
"""Send an intent to the supervisor and print its reply — manual test.

    python scripts/ask_supervisor.py "back up cat9k-lab-01"
    python scripts/ask_supervisor.py "is nexus-lab-02 compliant?"

Requires: pip install httpx
"""

from __future__ import annotations

import os
import sys

import httpx


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: ask_supervisor.py <intent text>", file=sys.stderr)
        return 2
    base = os.environ.get("SUPERVISOR_URL", "http://127.0.0.1:8088")
    resp = httpx.post(f"{base}/intent", json={"text": " ".join(sys.argv[1:])}, timeout=600.0)
    resp.raise_for_status()
    print(resp.json()["reply"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
