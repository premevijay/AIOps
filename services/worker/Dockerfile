# Build context is the repo ROOT (see compose.yaml) so the worker image can bake
# in the shared ansible/ project. Run with: docker compose build worker
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    ANSIBLE_COLLECTIONS_PATH=/app/ansible/collections

# git: version configs in the store. openssh-client: network_cli to devices.
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake in the Ansible project + vendor collections.
COPY ansible /app/ansible
RUN ansible-galaxy collection install -r /app/ansible/collections/requirements.yml \
    -p /app/ansible/collections

COPY services/worker/aiops_worker ./aiops_worker

RUN useradd --create-home --uid 10001 worker && mkdir -p /data/configs && chown -R worker /data
USER worker

CMD ["python", "-m", "aiops_worker"]
