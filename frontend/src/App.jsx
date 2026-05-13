import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const COUNTRY_CURRENCY_MAP = {
  'United Arab Emirates': 'AED',
  'India': 'INR',
  'Sri Lanka': 'LKR',
  'China': 'CNY',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  'Canada': 'CAD',
  'Germany': 'EUR',
  'France': 'EUR',
  'Australia': 'AUD',
  'Japan': 'JPY',
  'Singapore': 'SGD',
  'Switzerland': 'CHF',
  'Brazil': 'BRL',
  'South Africa': 'ZAR',
  'Saudi Arabia': 'SAR',
  'Mexico': 'MXN'
}

const COUNTRY_OPTIONS = Object.keys(COUNTRY_CURRENCY_MAP)
const EXPERIENCE_OPTIONS = ['1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9', '9-10', '10 & above']

const FIELDS = [
  {
    key: 'country',
    label: 'Country',
    placeholder: 'Select a country',
    icon: '🌍',
    multiline: false,
    type: 'select',
    options: COUNTRY_OPTIONS,
  },
  {
    key: 'job_title',
    label: 'Job Title',
    placeholder: 'e.g. Senior Software Engineer, Data Analyst, HR Business Partner',
    icon: '💼',
    multiline: false,
    type: 'text',
  },
  {
    key: 'years_of_experience',
    label: 'Years of Experience',
    placeholder: 'Select years of experience',
    icon: '📅',
    multiline: false,
    type: 'select',
    options: EXPERIENCE_OPTIONS,
  },
  {
    key: 'currency',
    label: 'Currency',
    placeholder: 'Currency auto-filled from country',
    icon: '💱',
    multiline: false,
    type: 'readonly',
  },
  {
    key: 'job_description',
    label: 'Job Description Summary',
    placeholder: 'Briefly describe the key responsibilities and required skills for this role…',
    icon: '📋',
    multiline: true,
  },
]

export default function App() {
  const reportRef = useRef(null)
  const [form, setForm] = useState({
    country: '',
    job_title: '',
    years_of_experience: '',
    job_description: '',
    currency: '',
  })
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (key, value) => {
    if (key === 'country') {
      const currency = COUNTRY_CURRENCY_MAP[value] || ''
      setForm(prev => ({ ...prev, country: value, currency }))
      return
    }

    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const missing = FIELDS.find(f => !form[f.key]?.trim())
    if (missing) {
      setError(`Please fill in the "${missing.label}" field.`)
      return
    }
    setLoading(true)
    setError('')
    setAnalysis('')

    try {
      const res = await fetch(`https://myapp-backend-210612455139.us-central1.run.app/api/analyze-salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(180000),
      })

      const rawText = await res.text()


      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const errJson = JSON.parse(rawText)
          detail = errJson?.detail || rawText || detail
        } catch {
          detail = rawText || detail
        }
        throw new Error(detail)
      }

      let data
      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error('Server returned an unexpected response. Please try again.')
      }
      setAnalysis(data.analysis)
    } catch (err) {
      if (err.name === 'TimeoutError') {
        setError('The request timed out after 3 minutes. Please try again.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const downloadReportPdf = async () => {
    if (!reportRef.current) return
    setPdfLoading(true)
    setError('')

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('portrait', 'pt', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      let heightLeft = imgHeight - pdfHeight

      while (heightLeft > 0) {
        position -= pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
      }

      const filename = `${form.job_title || 'salary-report'}-${form.country || 'report'}`
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-_.]/g, '')
        .toLowerCase() + '.pdf'

      pdf.save(filename)
    } catch (err) {
      console.error(err)
      setError('Unable to generate PDF. Use Print and save as PDF as a fallback.')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleReset = () => {
    setForm({ country: '', job_title: '', years_of_experience: '', job_description: '', currency: '' })
    setAnalysis('')
    setError('')
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">📊</span>
            <div>
              <div className="logo-title">SalaryIQ</div>
              <div className="logo-sub">Real-Time Market Salary Analyzer</div>
            </div>
          </div>
          <div className="header-badge">
            <span className="badge-dot" />
            Live Market Data
          </div>
        </div>
      </header>

      <main className="main">
        {/* Hero */}
        <div className="hero">
          <h1 className="hero-title">Global Salary Benchmarking</h1>
          <p className="hero-sub">
            AI-powered analysis using live job postings, current economic conditions,
            and real-time hiring trends — so every offer is grounded in today's market.
          </p>
          <div className="hero-chips">
            <span className="chip">🔍 Live Job Postings</span>
            <span className="chip">📈 Economic Indicators</span>
            <span className="chip">🌐 Geopolitical Factors</span>
            <span className="chip">⚡ Instant Analysis</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="card form-card">
          <div className="card-header">
            <h2 className="card-title">Enter Role Details</h2>
            <p className="card-desc">Fill in all fields — the AI will search current market data and return a full salary report.</p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="form-grid">
              {FIELDS.filter(f => !f.multiline).map(field => (
                <div className="field" key={field.key}>
                  <label className="label">
                    <span className="label-icon">{field.icon}</span>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      className="input"
                      value={form[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      disabled={loading}
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type="text"
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={e => handleChange(field.key, e.target.value)}
                      disabled={loading || field.type === 'readonly'}
                      readOnly={field.type === 'readonly'}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Job Description spans full width */}
            {FIELDS.filter(f => f.multiline).map(field => (
              <div className="field field-full" key={field.key}>
                <label className="label">
                  <span className="label-icon">{field.icon}</span>
                  {field.label}
                </label>
                <textarea
                  className="input textarea"
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={e => handleChange(field.key, e.target.value)}
                  rows={4}
                  disabled={loading}
                />
              </div>
            ))}

            {error && (
              <div className="error-box">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="form-actions">
              {analysis && (
                <button type="button" className="btn btn-outline" onClick={handleReset} disabled={loading}>
                  New Analysis
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Searching live market data…
                  </>
                ) : (
                  <>
                    <span>🔍</span> Generate Salary Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="card loading-card">
            <div className="loading-steps">
              <LoadingStep icon="🌐" text="Searching current job postings & salary listings" />
              <LoadingStep icon="📊" text="Analysing economic indicators & inflation data" />
              <LoadingStep icon="🗺️" text="Evaluating geopolitical & policy factors" />
              <LoadingStep icon="⚙️" text="Calculating adjustments & generating report" />
            </div>
            <p className="loading-note">This may take 20–40 seconds — Gemini is querying live data sources.</p>
          </div>
        )}

        {/* Results */}
        {analysis && !loading && (
          <div className="card results-card" ref={reportRef}>
            <div className="results-header">
              <div>
                <h2 className="card-title">Salary Analysis Report</h2>
                <p className="card-desc">
                  {form.job_title} · {form.country} · {form.years_of_experience} yrs exp · {form.currency}
                </p>
              </div>
              <div className="results-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={downloadReportPdf}
                  disabled={pdfLoading}
                >
                  {pdfLoading ? 'Generating PDF…' : '⬇️ Download PDF'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                  🖨 Print Report
                </button>
              </div>
            </div>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by Gemini AI with Google Search grounding · Real-time market data · {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}

function LoadingStep({ icon, text }) {
  return (
    <div className="loading-step">
      <span className="step-icon">{icon}</span>
      <span className="step-text">{text}</span>
      <span className="step-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}
