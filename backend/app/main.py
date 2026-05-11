from pathlib import Path

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import Settings, get_settings
from backend.app.models import WeatherResponse
from backend.app.services.weather import WeatherService

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "frontend" / "dist"
ASSETS_DIR = STATIC_DIR / "assets"

app = FastAPI(title="Weatherly API", version="1.0.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_weather_service(settings: Settings = Depends(get_settings)) -> WeatherService:
    return WeatherService(settings)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/weather", response_model=WeatherResponse)
async def weather(
    city: str = Query(..., min_length=2, max_length=120, description="City, town, or place name"),
    service: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    return await service.get_weather(city.strip())


if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/{path:path}", include_in_schema=False)
async def spa(path: str) -> FileResponse:
    index = STATIC_DIR / "index.html"
    return FileResponse(index)
