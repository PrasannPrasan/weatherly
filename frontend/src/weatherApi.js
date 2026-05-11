const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const describeWeather = (code) => WEATHER_CODES[code] || "Unknown conditions";

const requestJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.reason || "Unable to fetch weather.");
  }

  return data;
};

const fromBackend = async (city, signal) =>
  requestJson(`/api/weather?city=${encodeURIComponent(city)}`, signal);

const fromOpenMeteo = async (city, signal) => {
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  });

  const geocode = await requestJson(geocodeUrl, signal);
  const [result] = geocode.results || [];

  if (!result) {
    throw new Error(`No location found for '${city}'.`);
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search = new URLSearchParams({
    latitude: String(result.latitude),
    longitude: String(result.longitude),
    timezone: "auto",
    forecast_days: "7",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(","),
  });

  const forecast = await requestJson(forecastUrl, signal);

  return {
    query: city,
    location: {
      name: result.name,
      country: result.country,
      admin1: result.admin1,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    },
    current: {
      temperature_c: forecast.current.temperature_2m,
      apparent_temperature_c: forecast.current.apparent_temperature,
      humidity_percent: forecast.current.relative_humidity_2m,
      wind_speed_kmh: forecast.current.wind_speed_10m,
      wind_direction_degrees: forecast.current.wind_direction_10m,
      weather_code: forecast.current.weather_code,
      description: describeWeather(forecast.current.weather_code),
      is_day: Boolean(forecast.current.is_day),
      time: forecast.current.time,
    },
    daily: forecast.daily.time.map((date, index) => ({
      date,
      weather_code: forecast.daily.weather_code[index],
      description: describeWeather(forecast.daily.weather_code[index]),
      temp_max_c: forecast.daily.temperature_2m_max[index],
      temp_min_c: forecast.daily.temperature_2m_min[index],
      precipitation_probability_max_percent: forecast.daily.precipitation_probability_max?.[index] ?? null,
      sunrise: forecast.daily.sunrise?.[index] ?? null,
      sunset: forecast.daily.sunset?.[index] ?? null,
    })),
  };
};

export async function fetchWeather(city, signal) {
  try {
    return await fromBackend(city, signal);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return fromOpenMeteo(city, signal);
  }
}
