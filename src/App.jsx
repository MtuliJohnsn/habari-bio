import { useMemo, useState } from 'react'
import './App.css'

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const today = new Date()
const dateString = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
const todayString = dateString(today)
const maxForecastDate = new Date(today)
maxForecastDate.setDate(maxForecastDate.getDate() + 15)
const maxDateString = dateString(maxForecastDate)

function weatherInfo(code) {
  if (code === 0) return { label: 'Clear', icon: '☀️' }
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: '🌤️' }
  if (code === 3) return { label: 'Cloudy', icon: '☁️' }
  if ([45, 48].includes(code)) return { label: 'Fog', icon: '🌫️' }
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: '🌦️' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: '🌧️' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: '❄️' }
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', icon: '⛈️' }
  return { label: 'Mixed conditions', icon: '🌡️' }
}

function scoreActivities(day) {
  const code = day.weather_code
  const rain = day.precipitation_probability_max ?? 0
  const wind = day.wind_speed_10m_max ?? 0
  const high = day.temperature_2m_max
  const storm = [95, 96, 99].includes(code)
  const wet = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 85, 86].includes(code)
  const clamp = (value) => Math.max(1, Math.min(10, Math.round(value)))
  return [
    { name: 'Walking', icon: '🚶', score: clamp(9 - rain * 0.045 - wind * 0.035 - (storm ? 5 : 0)) },
    { name: 'Running', icon: '🏃', score: clamp(9 - Math.max(0, high - 22) * 0.25 - Math.max(0, 8 - high) * 0.25 - rain * 0.055 - wind * 0.04 - (storm ? 5 : 0)) },
    { name: 'Fishing', icon: '🎣', score: clamp(9 - rain * 0.035 - Math.max(0, wind - 15) * 0.18 - (storm ? 7 : 0)) },
    { name: 'Beach', icon: '🏖️', score: clamp(3 + (high - 18) * 0.35 - rain * 0.06 - wind * 0.06 - (storm ? 5 : 0)) },
    { name: 'Sightseeing', icon: '📸', score: clamp(9 - rain * 0.045 - wind * 0.025 - (storm ? 5 : 0)) },
    { name: 'Hiking', icon: '🥾', score: clamp(9 - rain * 0.05 - wind * 0.05 - Math.max(0, high - 27) * 0.3 - (storm ? 6 : 0)) },
  ].map((activity) => ({ ...activity, score: wet && activity.name === 'Beach' ? Math.min(activity.score, 4) : activity.score }))
}

function outfitFor(day) {
  const high = day.temperature_2m_max
  const low = day.temperature_2m_min
  const rain = day.precipitation_probability_max ?? 0
  const clothes = []
  if (high >= 27) clothes.push('Light T-shirt and shorts')
  else if (high >= 19) clothes.push('T-shirt with trousers or light layers')
  else if (high >= 10) clothes.push('Sweater and long trousers')
  else clothes.push('Warm coat and thermal layers')
  if (low < 14) clothes.push('Bring a light jacket for the evening')
  if (rain >= 35) clothes.push('Pack a waterproof jacket and shoes')
  if ((day.uv_index_max ?? 0) >= 6) clothes.push('Wear a hat and UV-protective sunglasses')
  return clothes
}

function makeChecklist(days) {
  const list = [
    'Travel documents and identification',
    'Phone, charger and power bank',
    'Wallet, payment cards and some cash',
    'Personal medication and basic first aid',
    'Toiletries and personal essentials',
    'Comfortable walking shoes',
  ]
  if (days.some((day) => (day.precipitation_probability_max ?? 0) >= 30)) list.push('Umbrella or waterproof jacket')
  if (days.some((day) => day.temperature_2m_max >= 26)) list.push('Light clothing, sunscreen and sunglasses')
  if (days.some((day) => day.temperature_2m_min < 12)) list.push('Warm layers for cooler mornings and evenings')
  if (days.some((day) => (day.uv_index_max ?? 0) >= 6)) list.push('High-SPF sunscreen and a sun hat')
  if (days.some((day) => [71, 73, 75, 77, 85, 86].includes(day.weather_code))) list.push('Warm waterproof footwear')
  return [...new Set(list)]
}

function App() {
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState(todayString)
  const [endDate, setEndDate] = useState(todayString)
  const [tripType, setTripType] = useState('Holiday')
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkedItems, setCheckedItems] = useState([])

  const tripDays = useMemo(() => {
    if (!plan) return []
    return plan.weather.daily.time.map((date, index) => ({
      date,
      weather_code: plan.weather.daily.weather_code[index],
      temperature_2m_max: plan.weather.daily.temperature_2m_max[index],
      temperature_2m_min: plan.weather.daily.temperature_2m_min[index],
      precipitation_probability_max: plan.weather.daily.precipitation_probability_max?.[index] ?? 0,
      wind_speed_10m_max: plan.weather.daily.wind_speed_10m_max?.[index] ?? 0,
      uv_index_max: plan.weather.daily.uv_index_max?.[index] ?? 0,
    }))
  }, [plan])

  const checklist = useMemo(() => makeChecklist(tripDays), [tripDays])

  async function createPlan(event) {
    event.preventDefault()
    setError('')
    setPlan(null)
    setCheckedItems([])
    if (!destination.trim()) return setError('Enter a destination to continue.')
    if (endDate < startDate) return setError('Your return date must be on or after your departure date.')
    if (startDate < todayString || endDate > maxDateString) {
      return setError('For this first version, choose dates from today through the next 16 days so we can use the weather forecast.')
    }

    setLoading(true)
    try {
      const geoResponse = await fetch(`${GEO_URL}?name=${encodeURIComponent(destination.trim())}&count=1&language=en&format=json`)
      if (!geoResponse.ok) throw new Error('Destination search is temporarily unavailable. Please try again.')
      const geoData = await geoResponse.json()
      const place = geoData.results?.[0]
      if (!place) throw new Error('We could not find that destination. Check the spelling and try again.')

      const params = new URLSearchParams({
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        timezone: 'auto',
        forecast_days: '16',
      })
      const weatherResponse = await fetch(`${WEATHER_URL}?${params}`)
      if (!weatherResponse.ok) throw new Error('We could not load the forecast for this destination.')
      const weather = await weatherResponse.json()
      const selectedDays = weather.daily.time
        .map((date, index) => ({ date, index }))
        .filter(({ date }) => date >= startDate && date <= endDate)
      if (!selectedDays.length) throw new Error('Forecast data is not available for those dates yet.')

      const daily = Object.fromEntries(Object.entries(weather.daily).map(([key, values]) => [
        key,
        Array.isArray(values) ? selectedDays.map(({ index }) => values[index]) : values,
      ]))
      setPlan({
        place: {
          name: place.name,
          region: [place.admin1, place.country].filter(Boolean).join(', '),
        },
        weather: { daily },
        tripType,
      })
    } catch (err) {
      setError(err.message || 'Something went wrong while creating your trip plan.')
    } finally {
      setLoading(false)
    }
  }

  function toggleChecklist(item) {
    setCheckedItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])
  }

  const averageHigh = tripDays.length ? Math.round(tripDays.reduce((sum, day) => sum + day.temperature_2m_max, 0) / tripDays.length) : 0
  const rainyDays = tripDays.filter((day) => day.precipitation_probability_max >= 40).length

  return (
    <div className="travel-app">
      <header className="travel-header">
        <a className="travel-brand" href="/" aria-label="HABARI Travel Weather home">
          <span className="travel-logo">☀</span>
          <span>HABARI <b>Travel Weather</b></span>
        </a>
        <span className="free-label">FREE TRAVEL PLANNER</span>
      </header>

      <main className="travel-main">
        <section className="hero">
          <p className="travel-eyebrow">TRAVEL SMARTER WITH THE WEATHER</p>
          <h1>Your trip, <span>beautifully planned.</span></h1>
          <p className="hero-description">Tell us where you are going. We will help you prepare with a destination forecast, packing checklist, daily outfit ideas and weather-based activity scores.</p>
        </section>

        <section className="planner-card">
          <div className="planner-heading">
            <div className="planner-icon">🧳</div>
            <div><h2>Plan your trip</h2><p>Where would you like to go?</p></div>
          </div>
          <form className="trip-form" onSubmit={createPlan}>
            <label className="field destination-field">
              <span>DESTINATION</span>
              <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="e.g. Paris, France" required />
            </label>
            <label className="field">
              <span>DEPARTURE</span>
              <input type="date" value={startDate} min={todayString} max={maxDateString} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value) }} required />
            </label>
            <label className="field">
              <span>RETURN</span>
              <input type="date" value={endDate} min={startDate} max={maxDateString} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
            <label className="field">
              <span>TRIP TYPE</span>
              <select value={tripType} onChange={(event) => setTripType(event.target.value)}>
                <option>Holiday</option><option>Adventure</option><option>Family</option><option>Business</option><option>Outdoor</option>
              </select>
            </label>
            <button className="create-plan-button" type="submit" disabled={loading}>{loading ? 'Checking forecast…' : 'Create my travel plan'} <span>→</span></button>
          </form>
          {error && <p className="travel-error" role="alert">{error}</p>}
          <p className="forecast-note">Weather forecast is currently available up to 16 days ahead. Longer-range trip guidance can be added in a future version.</p>
        </section>

        {!plan && (
          <section className="feature-grid">
            <article><span>🌦️</span><h3>Destination forecast</h3><p>See expected conditions for each day of your trip.</p></article>
            <article><span>👕</span><h3>Daily outfit ideas</h3><p>Know what to wear based on temperature, rain and UV.</p></article>
            <article><span>🎣</span><h3>Activity scores</h3><p>Compare outdoor activities with easy 1–10 scores.</p></article>
            <article><span>✅</span><h3>Smart packing list</h3><p>Get a checklist tailored to the weather ahead.</p></article>
          </section>
        )}

        {plan && (
          <section className="results">
            <div className="results-title">
              <div><p className="travel-eyebrow">YOUR PERSONAL TRIP OUTLOOK</p><h2>{plan.place.name}</h2><p>{plan.place.region} · {plan.tripType} · {tripDays.length} {tripDays.length === 1 ? 'day' : 'days'}</p></div>
              <button className="edit-trip" onClick={() => { setPlan(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit trip</button>
            </div>
            <div className="summary-strip">
              <div><span>🌡️</span><small>Average high</small><strong>{averageHigh}°C</strong></div>
              <div><span>🌧️</span><small>Rainy days</small><strong>{rainyDays} of {tripDays.length}</strong></div>
              <div><span>📅</span><small>Travel dates</small><strong>{new Date(startDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(endDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></div>
            </div>

            <section className="result-section">
              <div className="result-heading"><div><p className="travel-eyebrow">DAY BY DAY</p><h3>Your forecast and outfit guide</h3></div></div>
              <div className="day-cards">
                {tripDays.map((day) => {
                  const info = weatherInfo(day.weather_code)
                  return <article className="day-card" key={day.date}>
                    <div className="day-card-top"><div><strong>{new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' })}</strong><small>{new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div><span className="day-weather-icon">{info.icon}</span></div>
                    <p className="day-condition-text">{info.label}</p>
                    <div className="day-temperatures"><strong>{Math.round(day.temperature_2m_max)}°</strong><span>{Math.round(day.temperature_2m_min)}°C low</span></div>
                    <div className="day-facts"><span>🌧️ {day.precipitation_probability_max}% rain</span><span>💨 {Math.round(day.wind_speed_10m_max)} km/h wind</span><span>☀️ UV {Math.round(day.uv_index_max)}</span></div>
                    <div className="outfit-tip"><b>👕 What to wear</b>{outfitFor(day).map((tip) => <span key={tip}>{tip}</span>)}</div>
                  </article>
                })}
              </div>
            </section>

            <div className="result-columns">
              <section className="result-section checklist-section">
                <div className="result-heading"><div><p className="travel-eyebrow">GET READY</p><h3>Packing checklist</h3></div><span className="progress-count">{checkedItems.length}/{checklist.length}</span></div>
                <div className="checklist">
                  {checklist.map((item) => <label className={checkedItems.includes(item) ? 'check-item checked' : 'check-item'} key={item}><input type="checkbox" checked={checkedItems.includes(item)} onChange={() => toggleChecklist(item)} /><span>{item}</span></label>)}
                </div>
              </section>
              <section className="result-section activity-section">
                <div className="result-heading"><div><p className="travel-eyebrow">MAKE THE MOST OF IT</p><h3>Activity weather scores</h3></div></div>
                <p className="score-explainer">Daily scores are based on forecast conditions. Higher is generally more suitable.</p>
                {tripDays.map((day) => <div className="activity-day" key={day.date}><strong>{new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><div className="activity-scores">{scoreActivities(day).map((activity) => <span className="activity-score" key={activity.name}><i>{activity.icon}</i>{activity.name}<b>{activity.score}/10</b></span>)}</div></div>)}
              </section>
            </div>
            <div className="advisory-card"><span>💡</span><div><b>Your travel advisory</b><p>{rainyDays ? `Rain may affect ${rainyDays} day(s) of your trip. Keep a waterproof layer handy and consider indoor alternatives on wetter days. ` : 'The forecast looks relatively dry during your selected dates. '}Pack for an average high of {averageHigh}°C, and check the forecast again before departure because conditions can change.</p></div></div>
            <p className="weather-attribution">Forecast data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Activity scores are planning guidance, not safety guarantees.</p>
          </section>
        )}
      </main>
      <footer className="travel-footer"><span>HABARI Travel Weather</span><span>Plan well. Travel happy. ☀️</span></footer>
    </div>
  )
}

export default App
