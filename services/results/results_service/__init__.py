"""AIOps Results Store service — persists worker job results for the dashboard.

A NATS subscriber that consumes every JobResult the worker fans out on
``aiops.results``, normalizes it into a stored ResultRecord, and exposes a small
FastAPI read API so the dashboard's Compliance/Backup/Health tiles can read the
latest per-device-per-op outcome.
"""

__version__ = "0.1.0"
