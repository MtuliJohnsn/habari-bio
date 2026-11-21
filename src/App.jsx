import { useCallback, useEffect, useState } from 'react'
import './App.css'

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'

function weatherInfo(code, isDay = 1) {
  if (code === 0) return { label: 'Clear sky', icon: isDay ? '☀️' : '🌙' }
  if ([1, 2].includes(code)) return { label: 'Mostly clear', icon: isDay ? '🌤️' : '☁️' }
  if (code === 3) return { label: 'Overcast', icon: '☁️' }
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '🌫️' }
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: '🌦️' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: '🌧️' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: '❄️' }
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: '⛈️' }
  return { label: 'Current conditions', icon: '🌡️' }
}

function dayName(date, index) {
  if (index === 0) return 'Today'
  return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })
}

function formatHour(dateTime) {
  return new Date(dateTime).toLocaleTimeString(undefined, { hour: 'numeric' })
}

function App() {
  const [place, setPlace] = useState(null)
  const [weather, setWeather] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState('fahrenheit')

  const loadWeather = useCallback(async (latitude, longitude, location) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
        temperature_unit: unit,
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
        timezone: 'auto',
        forecast_days: '7',
      })
      const response = await fetch(`${WEATHER_URL}?${params}`)
      if (!response.ok) throw new Error('Weather data is temporarily unavailable.')
      const data = await response.json()
      setWeather(data)
      setPlace(location)
    } catch (err) {
      setError(err.message || 'Could not load weather. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [unit])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location is not supported by this browser. Search for a city instead.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadWeather(coords.latitude, coords.longitude, { name: 'Your location', region: 'Current location' }),
      () => {
        setLoading(false)
        setError('Location permission was not granted. Search for a city to see its weather.')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    )
  }, [loadWeather])

  useEffect(() => {
    useMyLocation()
  }, [useMyLocation])

  async function searchCity(event) {
    event.preventDefault()
    const city = query.trim()
    if (!city) return
    setSearching(true)
    setError('')
    try {
      const response = await fetch(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
      if (!response.ok) throw new Error('City search is unavailable right now.')
      const data = await response.json()
      const result = data.results?.[0]
      if (!result) throw new Error('We could not find that city. Check the spelling and try again.')
      await loadWeather(result.latitude, result.longitude, {
        name: result.name,
        region: [result.admin1, result.country].filter(Boolean).join(', '),
      })
      setQuery('')
    } catch (err) {
      setError(err.message || 'Could not find that city.')
    } finally {
      setSearching(false)
    }
  }

  const current = weather?.current
  const currentInfo = current ? weatherInfo(current.weather_code, current.is_day) : null
  const hourly = weather?.hourly
  const daily = weather?.daily
  const currentHour = hourly ? hourly.time.findIndex((time) => time >= current.time) : 0
  const hourlyStart = Math.max(0, currentHour)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="HABARI Weather home">
          <span className="brand-mark">☀</span>
          <span>HABARI <b>Weather</b></span>
        </a>
        <form className="search-form" onSubmit={searchCity}>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search city"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city..."
          />
          <button type="submit" disabled={searching || !query.trim()}>
            {searching ? 'Searching' : 'Search'}
          </button>
        </form>
        <button className="location-button" onClick={useMyLocation} title="Use my location" aria-label="Use my location">◎</button>
      </header>

      <main className="main-content">
        <div className="intro-row">
          <div>
            <p className="eyebrow">YOUR WEATHER, AT A GLANCE</p>
            <h1>Weather made <span>simple.</span></h1>
          </div>
          <div className="unit-switch" aria-label="Temperature unit">
            <button className={unit === 'fahrenheit' ? 'selected' : ''} onClick={() => setUnit('fahrenheit')}>°F</button>
            <button className={unit === 'celsius' ? 'selected' : ''} onClick={() => setUnit('celsius')}>°C</button>
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        {loading && !weather ? (
          <section className="empty-state">
            <div className="loading-sun">☀️</div>
            <h2>Getting your forecast</h2>
            <p>Just a moment while we check the sky.</p>
          </section>
        ) : !weather ? (
          <section className="empty-state">
            <div className="loading-sun">🌤️</div>
            <h2>Find your local weather</h2>
            <p>Allow location access or search for a city above.</p>
            <button className="primary-button" onClick={useMyLocation}>Use my location</button>
          </section>
        ) : (
          <>
            <section className="current-card">
              <div className="current-copy">
                <p className="location-label">CURRENT WEATHER</p>
                <h2>{place?.name}</h2>
                <p className="region">{place?.region}</p>
                <div className="temperature">{Math.round(current.temperature_2m)}<span>°{unit === 'fahrenheit' ? 'F' : 'C'}</span></div>
                <p className="condition">{currentInfo.icon} {currentInfo.label}</p>
                <p className="feels-like">Feels like {Math.round(current.apparent_temperature)}°</p>
              </div>
              <div className="weather-art" aria-hidden="true">
                <span>{currentInfo.icon}</span>
              </div>
              <div className="current-stats">
                <div><span>💧</span><small>Humidity</small><strong>{current.relative_humidity_2m}%</strong></div>
                <div><span>🌬️</span><small>Wind</small><strong>{Math.round(current.wind_speed_10m)} mph</strong></div>
                <div><span>☔</span><small>Precipitation</small><strong>{current.precipitation} in</strong></div>
              </div>
            </section>

            <section className="forecast-section">
              <div className="section-heading">
                <div><p className="eyebrow">THE NEXT FEW HOURS</p><h2>Hourly forecast</h2></div>
              </div>
              <div className="hourly-list">
                {hourly?.time.slice(hourlyStart, hourlyStart + 12).map((time, index) => {
                  const i = hourlyStart + index
                  const info = weatherInfo(hourly.weather_code[i])
                  return <div className="hour-item" key={time}>
                    <span className="hour-time">{index === 0 ? 'Now' : formatHour(time)}</span>
                    <span className="hour-icon">{info.icon}</span>
                    <strong>{Math.round(hourly.temperature_2m[i])}°</strong>
                    <small>💧 {hourly.precipitation_probability[i] ?? 0}%</small>
                  </div>
                })}
              </div>
            </section>

            <section className="forecast-section weekly-section">
              <div className="section-heading">
                <div><p className="eyebrow">PLAN AHEAD</p><h2>7-day forecast</h2></div>
              </div>
              <div className="daily-list">
                {daily?.time.map((date, index) => {
                  const info = weatherInfo(daily.weather_code[index])
                  return <div className="day-row" key={date}>
                    <strong className="day-name">{dayName(date, index)}</strong>
                    <span className="day-condition">{info.icon} <span>{info.label}</span></span>
                    <div className="temperature-range"><span>{Math.round(daily.temperature_2m_min[index])}°</span><div className="range-track"><i style={{ left: '18%', width: '64%' }} /></div><b>{Math.round(daily.temperature_2m_max[index])}°</b></div>
                  </div>
                })}
              </div>
            </section>
            <p className="attribution">Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.</p>
          </>
        )}
      </main>
      <footer className="footer"><span>HABARI Weather</span><span>Clear skies ahead. ☀️</span></footer>
    </div>
  )
}

export default App
