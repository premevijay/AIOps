FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY change_service ./change_service

RUN useradd --create-home --uid 10003 change
USER change

EXPOSE 8089
CMD ["python", "-m", "change_service"]
