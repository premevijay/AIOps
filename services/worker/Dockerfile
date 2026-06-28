FROM python:3.12-slim

# NAPALM/netmiko pull configs over SSH; no build toolchain needed for wheels.
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY aiops_worker ./aiops_worker

# Drop privileges.
RUN useradd --create-home --uid 10001 worker
USER worker

CMD ["python", "-m", "aiops_worker"]
