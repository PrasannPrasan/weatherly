import httpx
from fastapi import HTTPException, status

from backend.app.config import Settings
from backend.app.models import CurrentWeather, DailyForecast, Location, WeatherResponse
from backend.app.weather_codes import describe_weather


class WeatherService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def get_weather(self, query: str) -> WeatherResponse:
        location = await self._geocode(query)
        forecast = await self._forecast(location)

        current = forecast["current"]
        daily = forecast["daily"]

        daily_forecast = []
        for index, date in enumerate(daily["time"]):
            daily_forecast.append(
                DailyForecast(
                    date=date,
                    weather_code=daily["weather_code"][index],
                    description=describe_weather(daily["weather_code"][index]),
                    temp_max_c=daily["temperature_2m_max"][index],
                    temp_min_c=daily["temperature_2m_min"][index],
                    precipitation_probability_max_percent=self._optional_daily_value(
                        daily, "precipitation_probability_max", index
                    ),
                    sunrise=self._optional_daily_value(daily, "sunrise", index),
                    sunset=self._optional_daily_value(daily, "sunset", index),
                )
            )

        return WeatherResponse(
            query=query,
            location=location,
            current=CurrentWeather(
                temperature_c=current["temperature_2m"],
                apparent_temperature_c=current["apparent_temperature"],
                humidity_percent=current["relative_humidity_2m"],
                wind_speed_kmh=current["wind_speed_10m"],
                wind_direction_degrees=current["wind_direction_10m"],
                weather_code=current["weather_code"],
                description=describe_weather(current["weather_code"]),
                is_day=bool(current["is_day"]),
                time=current["time"],
            ),
            daily=daily_forecast,
        )

    @staticmethod
    def _optional_daily_value(daily: dict, key: str, index: int):
        values = daily.get(key) or []
        if index >= len(values):
            return None
        return values[index]

    async def _geocode(self, query: str) -> Location:
        params = {"name": query, "count": 1, "language": "en", "format": "json"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(self.settings.open_meteo_geocoding_url, params=params)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Geocoding provider is unavailable.",
            )

        payload = response.json()
        results = payload.get("results") or []
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No location found for '{query}'.",
            )

        result = results[0]
        return Location(
            name=result["name"],
            country=result.get("country"),
            admin1=result.get("admin1"),
            latitude=result["latitude"],
            longitude=result["longitude"],
            timezone=result.get("timezone"),
        )

    async def _forecast(self, location: Location) -> dict:
        params = {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timezone": "auto",
            "forecast_days": 7,
            "current": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "is_day",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_direction_10m",
                ]
            ),
            "daily": ",".join(
                [
                    "weather_code",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_probability_max",
                    "sunrise",
                    "sunset",
                ]
            ),
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.settings.open_meteo_base_url}/forecast", params=params)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Weather provider is unavailable.",
            )

        return response.json()
