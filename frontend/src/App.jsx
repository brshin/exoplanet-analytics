import { useEffect, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import './App.css'

const Plot = createPlotlyComponent(Plotly)

const API = 'http://localhost:8000'

function App() {
  const [planets, setPlanets] = useState([])
  const [selectedPlanet, setSelectedPlanet] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [loadingPlanets, setLoadingPlanets] = useState(true)
  const [loadingAi, setLoadingAi] = useState(false)
  const [error, setError] = useState('')

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
        if (!res.ok) throw new Error('Failed to generate AI analysis')
        return res.json()
      })
      .then((data) => setAiSummary(data.aiSummary))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAi(false))
  }

  if (loadingPlanets) return <p>Loading planets from NASA...</p>
  if (error && planets.length === 0) return <p>{error}</p>

  return (
    <div className="app">
      <h1>NASA Exoplanet Dashboard</h1>
      <p>Hover over the dots to see the name of the planet!</p>

      <label htmlFor="planet-select">Select a planet to analyze:</label>
      <select
        id="planet-select"
        value={selectedPlanet}
        onChange={(e) => {
          setSelectedPlanet(e.target.value)
          setAiSummary('')
        }}
      >
        {planets.map((p) => (
          <option key={p.pl_name} value={p.pl_name}>
            {p.pl_name}
          </option>
        ))}
      </select>

      <div className="metrics">
        <div className="metric">
          <span className="metric-label">Name</span>
          <span className="metric-value">{selectedPlanet}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Mass (Earth Masses)</span>
          <span className="metric-value">{selectedPlanetMass}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Orbital Period (Days)</span>
          <span className="metric-value">{selectedPlanetOrbitalPeriod}</span>
        </div>
      </div>

      <button onClick={generateAiAnalysis} disabled={loadingAi || !selectedPlanet}>
        Generate AI Analysis
      </button>

      {loadingAi && <p>Connecting to AI...</p>}
      {aiSummary && <p className="ai-summary">{aiSummary}</p>}
      {error && planets.length > 0 && <p className="error">{error}</p>}

      <Plot
        data={[
          {
            x: planets.map((p) => p.pl_bmasse),
            y: planets.map((p) => p.pl_orbper),
            text: planets.map((p) => p.pl_name),
            type: 'scatter',
            mode: 'markers',
            hovertemplate: '%{text}<extra></extra>',
          },
        ]}
        layout={{
          title: { text: 'Planet Mass vs Orbital Period' },
          xaxis: { type: 'log', title: { text: 'pl_bmasse' } },
          yaxis: { type: 'log', title: { text: 'pl_orbper' } },
          autosize: true,
        }}
        useResizeHandler
        style={{ width: '100%', height: '500px' }}
      />
    </div>
  )
}

export default App
