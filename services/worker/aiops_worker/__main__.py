"""Entrypoint: configure logging and run the bus worker."""

from __future__ import annotations

import asyncio
import logging

import structlog

from .bus import run
from .config import settings


def _configure_logging() -> None:
    logging.basicConfig(level=settings.log_level.upper())
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )


def main() -> None:
    _configure_logging()
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
