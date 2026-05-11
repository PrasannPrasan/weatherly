from pydantic import BaseModel, Field


class Location(BaseModel):
    name: str
    country: str | None = None
    admin1: str | None = None
    latitude: float
    longitude: float
    timezone: str | None = None


class CurrentWeather(BaseModel):
    temperature_c: float
    apparent_temperature_c: float
    humidity_percent: int
    wind_speed_kmh: float
    wind_direction_degrees: int
    weather_code: int
    description: str
    is_day: bool
    time: str


class DailyForecast(BaseModel):
    date: str
    weather_code: int
    description: str
    temp_max_c: float
    temp_min_c: float
    precipitation_probability_max_percent: int | None = None
    sunrise: str | None = None
    sunset: str | None = None


class WeatherResponse(BaseModel):
    query: str = Field(..., examples=["Mumbai"])
    location: Location
    current: CurrentWeather
    daily: list[DailyForecast]
