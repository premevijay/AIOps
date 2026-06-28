FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY results_service ./results_service

RUN useradd --create-home --uid 10004 results
USER results

EXPOSE 8090
CMD ["python", "-m", "results_service"]
