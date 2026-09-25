import { useEffect, useMemo, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import './App.css'

const Plot = createPlotlyComponent(Plotly)

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CHART = {
  bg: '#0c1016',
  plot: '#121820',
  text: '#c5d0dc',
  grid: '#243040',
  marker: '#5b9fd4',
  selected: '#e8edf2',
  ring: '#5b9fd4',
}

function formatNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const value = Number(n)
  const digits = value >= 100 ? 1 : value >= 1 ? 2 : 3
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function App() {
  const [planets, setPlanets] = useState([])
  const [selectedPlanet, setSelectedPlanet] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [loadingPlanets, setLoadingPlanets] = useState(true)
  const [loadingAi, setLoadingAi] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  useEffect(() => {
    fetch(`${API}/planets`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load planets')
        return res.json()
      })
      .then((data) => {
        setPlanets(data)
        if (data.length > 0) setSelectedPlanet(data[0].pl_name)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPlanets(false))
  }, [])

  const selected = planets.find((p) => p.pl_name === selectedPlanet)
  const selectedPlanetMass = selected?.pl_bmasse
  const selectedPlanetOrbitalPeriod = selected?.pl_orbper
  const otherPlanets = planets.filter((p) => p.pl_name !== selectedPlanet)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? planets.filter((p) => p.pl_name.toLowerCase().includes(q))
      : planets
    return pool.slice(0, 8)
  }, [planets, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, pickerOpen])

  function selectPlanet(name) {
    setSelectedPlanet(name)
    setQuery('')
    setPickerOpen(false)
    setHighlightIndex(0)
    setAiSummary('')
  }

  function generateAiAnalysis() {
    setLoadingAi(true)
    setAiSummary('')
    setError('')

    fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedPlanet }),
    })
      .then((res) => {
        if (res.status === 429) {
          throw new Error('Too many AI requests from this connection. Try again in an hour.')
        }
        if (!res.ok) throw new Error('Failed to generate AI analysis')
        return res.json()
      })
      .then((data) => setAiSummary(data.aiSummary))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAi(false))
  }

  if (loadingPlanets) {
    return (
      <p className="status-screen">
        Loading the exoplanet catalog.
      </p>
    )
  }

  if (error && planets.length === 0) {
    return <p className="status-screen error">{error}</p>
  }

  const activeSuggestion = suggestions[highlightIndex]
  const activeOptionId = activeSuggestion ? `planet-option-${highlightIndex}` : undefined

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Exoplanet Analytics</h1>
          <p className="subtitle">
            {planets.length.toLocaleString()} planets with a measured mass and period ·{' '}
            <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">
              NASA Exoplanet Archive
            </a>
          </p>
        </div>
        <div className="planet-picker">
          <div className="picker-label-row">
            <label htmlFor="planet-search">Planet</label>
            <span className="picker-hint">Click a point or search</span>
          </div>
          <input
            id="planet-search"
            type="search"
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls="planet-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={pickerOpen ? activeOptionId : undefined}
            placeholder="Search planets"
            value={pickerOpen ? query : selectedPlanet}
            onFocus={() => {
              setPickerOpen(true)
              setQuery('')
            }}
            onBlur={() => {
              setPickerOpen(false)
              setQuery('')
              setHighlightIndex(0)
            }}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!pickerOpen) {
                  setPickerOpen(true)
                  setQuery('')
                  return
                }
                if (suggestions.length === 0) return
                setHighlightIndex((i) => (i + 1) % suggestions.length)
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (!pickerOpen || suggestions.length === 0) return
                setHighlightIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
              }
              if (e.key === 'Enter' && suggestions[highlightIndex]) {
                e.preventDefault()
                selectPlanet(suggestions[highlightIndex].pl_name)
              }
              if (e.key === 'Escape') {
                e.currentTarget.blur()
              }
            }}
          />
          {pickerOpen && (
            <ul id="planet-suggestions" className="suggestions" role="listbox">
              {suggestions.length === 0 && <li className="suggestion-empty">No matching planets</li>}
              {suggestions.map((p, index) => (
                <li key={p.pl_name}>
                  <button
                    type="button"
                    id={`planet-option-${index}`}
                    role="option"
                    aria-selected={index === highlightIndex}
                    className={index === highlightIndex ? 'is-active' : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectPlanet(p.pl_name)}
                  >
                    {p.pl_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="dashboard">
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Name</span>
            <span className="metric-value">{selectedPlanet}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Mass (Earth masses)</span>
            <span className="metric-value">{formatNumber(selectedPlanetMass)}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Orbital period (days)</span>
            <span className="metric-value">{formatNumber(selectedPlanetOrbitalPeriod)}</span>
          </div>
        </div>

        <div className="chart">
          <Plot
            data={[
              {
                x: otherPlanets.map((p) => p.pl_bmasse),
                y: otherPlanets.map((p) => p.pl_orbper),
                text: otherPlanets.map((p) => p.pl_name),
                type: 'scatter',
                mode: 'markers',
                marker: { size: 6, color: CHART.marker, opacity: 0.55 },
                hovertemplate: '%{text}<extra></extra>',
              },
              {
                x: selected ? [selected.pl_bmasse] : [],
                y: selected ? [selected.pl_orbper] : [],
                text: selected ? [selected.pl_name] : [],
                type: 'scatter',
                mode: 'markers',
                marker: {
                  size: 16,
                  color: CHART.selected,
                  opacity: 1,
                  line: { width: 2.5, color: CHART.ring },
                },
                hovertemplate: '%{text}<extra></extra>',
                showlegend: false,
              },
            ]}
            layout={{
              title: {
                text: 'Planet mass vs orbital period',
                font: { size: 15, color: CHART.text },
              },
              paper_bgcolor: CHART.bg,
              plot_bgcolor: CHART.plot,
              font: { family: 'IBM Plex Sans, sans-serif', color: CHART.text },
              xaxis: {
                type: 'log',
                title: { text: 'Mass (Earth masses)' },
                gridcolor: CHART.grid,
                zeroline: false,
                color: CHART.text,
              },
              yaxis: {
                type: 'log',
                title: { text: 'Orbital period (days)' },
                gridcolor: CHART.grid,
                zeroline: false,
                color: CHART.text,
              },
              margin: { t: 48, r: 24, b: 56, l: 64 },
              autosize: true,
              showlegend: false,
            }}
            onClick={(event) => {
              const name = event.points?.[0]?.text
              if (name) selectPlanet(name)
            }}
            config={{ displaylogo: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: '520px' }}
          />
        </div>

        <section className="ai-panel">
          <button onClick={generateAiAnalysis} disabled={loadingAi || !selectedPlanet}>
            Generate AI Analysis
          </button>
          {loadingAi && <p className="ai-status">Connecting to AI…</p>}
          {aiSummary && (
            <div className="ai-summary">
              <p className="ai-caption">Speculative · GPT-4o mini</p>
              <p>{aiSummary}</p>
            </div>
          )}
          {error && planets.length > 0 && <p className="error">{error}</p>}
        </section>
      </div>
    </div>
  )
}

export default App
