# AIOps NetOps Supervisor

The first **agent** — a LangGraph ReAct agent that turns a natural-language
intent into read-only capability calls on the execution worker. It is the
team-lead "network engineer" from the architecture: it coordinates work by
calling tools and **never touches devices directly**.

> LLM: a hosted Claude model via `langchain-anthropic`, behind a `ModelProvider`
> seam (decision #1) so a local model can be swapped later. Orchestration:
> LangGraph (decision #3).

## How it works

```
POST /intent {"text": "..."}
        │
        ▼
  LangGraph ReAct agent  ──calls──▶  capability tools (backup / health / compliance / list_devices)
   (Claude + system prompt)              │
                                         ▼
                              BusClient → NATS → worker → Ansible/AWX → device
```

The agent's tools are **read-only**. There is deliberately no tool that mutates a
device: if an intent needs a config change or remediation, the agent **proposes**
it and states that it requires the change-management approval path — it cannot
execute it. That guardrail is enforced by the tool surface, not just the prompt.

## Layout

```
aiops_supervisor/
  config.py          # env/.env settings (model id from ANTHROPIC_MODEL)
  model.py           # ModelProvider -> ChatAnthropic (lazy import)
  capabilities.py    # read-only capability metadata + result summarization (pure)
  inventory.py       # device resolution (pure)
  bus_client.py      # NATS request/reply to the worker
  tools.py           # LangChain tools wrapping capabilities + bus
  agent.py           # create_react_agent + system prompt (the guardrails)
  app.py             # FastAPI: POST /intent, GET /healthz
  __main__.py        # uvicorn entrypoint
tests/               # LLM/NATS-free unit tests
```

## Run it (from the repo root)

```bash
# .env: set ANTHROPIC_API_KEY and ANTHROPIC_MODEL (a current Claude model id)
docker compose up -d --build bus worker supervisor

pip install httpx
python scripts/ask_supervisor.py "back up cat9k-lab-01"
python scripts/ask_supervisor.py "is cat9k-lab-01 compliant?"
```

The agent calls the matching capability tool, which enqueues a job to the worker
(which runs the Ansible playbook / AWX job template) and summarizes the result.

## Tests

```bash
cd services/supervisor
pip install pydantic pydantic-settings structlog pyyaml pytest
python -m pytest
```

Tests need no LLM or NATS — they cover the read-only capability set, device
resolution, and result summarization.
