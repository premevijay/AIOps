#!/usr/bin/env python3
"""Enqueue a job on the bus and print the worker's reply — manual E2E test.

Usage (from inside the worker network, or with NATS_URL pointing at it):

    python scripts/enqueue_job.py health      --device cat9k-lab-01
    python scripts/enqueue_job.py backup      --device cat9k-lab-01
    python scripts/enqueue_job.py compliance  --device cat9k-lab-01

Devices are read from config/inventory.example.yaml unless --inventory is given.
Requires: pip install nats-py pyyaml
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

import nats
import yaml


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("op", choices=["health", "backup", "compliance", "get_config"])
    ap.add_argument("--device", required=True)
    ap.add_argument("--inventory", default="config/inventory.example.yaml")
    ap.add_argument("--nats", default=os.environ.get("NATS_URL", "nats://127.0.0.1:4222"))
    ap.add_argument("--subject", default="aiops.jobs")
    ap.add_argument("--timeout", type=float, default=30.0)
    args = ap.parse_args()

    inventory = yaml.safe_load(open(args.inventory))["devices"]
    device = next((d for d in inventory if d["name"] == args.device), None)
    if device is None:
        print(f"device {args.device!r} not in {args.inventory}", file=sys.stderr)
        return 2

    req = {"op": args.op, "device": device, "params": {}}
    nc = await nats.connect(args.nats)
    try:
        reply = await nc.request(
            f"{args.subject}.{args.op}",
            json.dumps(req).encode(),
            timeout=args.timeout,
        )
        print(json.dumps(json.loads(reply.data), indent=2))
    finally:
        await nc.drain()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
