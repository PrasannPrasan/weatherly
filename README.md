# Weatherly

A full-stack weather app with a Python FastAPI backend and a dynamic React frontend. Weather data comes from Open-Meteo, so local development works without managing API keys.

## Features

- Search weather by city or place name.
- Current temperature, feels-like temperature, humidity, wind, and condition.
- Seven-day forecast.
- React state for loading, errors, unit switching, quick cities, and recent searches.
- Backend hides third-party API calls behind `/api/weather`.
- Docker-ready for AWS App Runner, ECS, or Elastic Beanstalk.

## Run Locally

Start the Python API:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the React frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to FastAPI on port `8000`.

## Production Build

```powershell
cd frontend
npm install
npm run build
cd ..
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

## API

```http
GET /api/health
GET /api/weather?city=Mumbai
```

## Data Source

Weatherly uses the official Open-Meteo APIs:

- Forecast API: https://open-meteo.com/en/docs
- Geocoding API: https://open-meteo.com/en/docs/geocoding-api

## Docker

```powershell
docker build -t weatherly .
docker run --rm -p 8000:8000 weatherly
```

## AWS Hosting Path

The simplest AWS path is App Runner:

1. Build and push this Docker image to Amazon ECR.
2. Create an App Runner service from the ECR image.
3. Set port `8000`.
4. Add environment variables from `.env.example` only if you need custom CORS origins.

For a larger production setup, use ECS Fargate behind an Application Load Balancer and add CloudFront in front of the app.
