import { useEffect, useMemo, useState } from "react";
import { fetchWeather } from "./weatherApi";

const DEFAULT_CITY = "";
const QUICK_CITIES = ["Mumbai", "Delhi", "Bengaluru", "London", "New York"];

const iconForCode = (code, isDay = true) => {
  if (code === 0) return isDay ? "\u2600" : "\u263e";
  if ([1, 2].includes(code)) return "\u25d0";
  if ([3, 45, 48].includes(code)) return "\u2601";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "\u2602";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "\u273b";
  if ([95, 96, 99].includes(code)) return "\u26a1";
  return "\u25d0";
};

const formatDate = (date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));

const celsiusToFahrenheit = (value) => (value * 9) / 5 + 32;

const formatTemperature = (value, unit) => {
  const converted = unit === "F" ? celsiusToFahrenheit(value) : value;
  return `${Math.round(converted)}\u00b0${unit}`;
};

const placeName = (location) =>
  [location.name, location.admin1, location.country].filter(Boolean).join(", ");

function Metric({ label, value }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ForecastCard({ day, unit }) {
  return (
    <article className="forecast-card">
      <div className="forecast-icon" aria-hidden="true">
        {iconForCode(day.weather_code)}
      </div>
      <h3>{formatDate(day.date)}</h3>
      <p>{day.description}</p>
      <div className="temp-row">
        <span>{formatTemperature(day.temp_max_c, unit)}</span>
        <span>{formatTemperature(day.temp_min_c, unit)}</span>
      </div>
      <small>{day.precipitation_probability_max_percent ?? 0}% rain chance</small>
    </article>
  );
}

export default function App() {
  const [cityInput, setCityInput] = useState(DEFAULT_CITY);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITY);
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("Search a city to see the forecast.");
  const [error, setError] = useState("");
  const [unit, setUnit] = useState("C");
  const [recentCities, setRecentCities] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("weatherly:recentCities")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      if (!activeCity) {
        setWeather(null);
        setStatus("Search a city to see the forecast.");
        setError("");
        return;
      }

      setStatus("Loading forecast...");
      setError("");

      try {
        const data = await fetchWeather(activeCity, controller.signal);
        setWeather(data);
        setStatus("");
        setRecentCities((current) => {
          const next = [activeCity, ...current.filter((city) => city.toLowerCase() !== activeCity.toLowerCase())].slice(
            0,
            4
          );
          localStorage.setItem("weatherly:recentCities", JSON.stringify(next));
          return next;
        });
      } catch (requestError) {
        if (requestError.name === "AbortError") return;
        setWeather(null);
        setStatus("");
        setError(requestError.message);
      }
    }

    loadWeather();
    return () => controller.abort();
  }, [activeCity]);

  const currentPlace = useMemo(() => (weather ? placeName(weather.location) : ""), [weather]);

  const submitSearch = (event) => {
    event.preventDefault();
    const nextCity = cityInput.trim();
    if (nextCity.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    setActiveCity(nextCity);
  };

  const selectCity = (city) => {
    setCityInput(city);
    setActiveCity(city);
  };

  return (
    <main className="app-shell">
      <section className="search-panel" aria-label="Weather search">
        <div>
          <p className="eyebrow">Live forecast</p>
          <h1>Weatherly</h1>
          <p className="intro">Search any city for current conditions and a seven-day outlook.</p>
          <p className="maker-credit">Developed by Prasann</p>
        </div>

        <form className="search-form" onSubmit={submitSearch}>
          <label htmlFor="city">Location</label>
          <div className="search-row">
            <input
              id="city"
              name="city"
              type="search"
              value={cityInput}
              placeholder="Enter a city"
              autoComplete="address-level2"
              onChange={(event) => setCityInput(event.target.value)}
            />
            <button type="submit">Search</button>
          </div>
        </form>

        <div className="sidebar-actions">
          <div className="unit-toggle" aria-label="Temperature unit">
            <button className={unit === "C" ? "selected" : ""} type="button" onClick={() => setUnit("C")}>
              C
            </button>
            <button className={unit === "F" ? "selected" : ""} type="button" onClick={() => setUnit("F")}>
              F
            </button>
          </div>

          <div className="city-list">
            <p>Quick cities</p>
            <div>
              {QUICK_CITIES.map((city) => (
                <button key={city} type="button" onClick={() => selectCity(city)}>
                  {city}
                </button>
              ))}
            </div>
          </div>

          {recentCities.length > 0 && (
            <div className="city-list">
              <p>Recent</p>
              <div>
                {recentCities.map((city) => (
                  <button key={city} type="button" onClick={() => selectCity(city)}>
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="weather-panel" aria-live="polite">
        {status && <div className="status">{status}</div>}
        {error && <div className="status error">{error}</div>}

        {weather && (
          <>
            <article className="current-card">
              <div>
                <p className="eyebrow">{currentPlace}</p>
                <h2>{formatTemperature(weather.current.temperature_c, unit)}</h2>
                <p className="condition">{weather.current.description}</p>
              </div>
              <div className="current-icon" aria-hidden="true">
                {iconForCode(weather.current.weather_code, weather.current.is_day)}
              </div>
              <dl className="metrics">
                <Metric label="Feels like" value={formatTemperature(weather.current.apparent_temperature_c, unit)} />
                <Metric label="Humidity" value={`${weather.current.humidity_percent}%`} />
                <Metric label="Wind" value={`${Math.round(weather.current.wind_speed_kmh)} km/h`} />
              </dl>
            </article>

            <div className="forecast-grid">
              {weather.daily.map((day) => (
                <ForecastCard key={day.date} day={day} unit={unit} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
