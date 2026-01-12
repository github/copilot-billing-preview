import { useCallback, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import './App.css'
import { LineCountAggregator } from './pipeline/aggregators/lineCountAggregator'
import { runPipeline } from './pipeline/runPipeline'

type Status = 'idle' | 'processing' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [lineCount, setLineCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setLineCount(null)
    setFileName(file.name)

    try {
      const aggregator = new LineCountAggregator()
      await runPipeline(file, [aggregator])
      setLineCount(aggregator.result().lineCount)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process the report.')
      setStatus('idle')
    }
  }, [])

  const preventDefault = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    preventDefault(event)
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void handleProcess(file)
    }
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    preventDefault(event)
    setDragActive(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    preventDefault(event)
    setDragActive(false)
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleProcess(file)
      event.target.value = ''
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      document.getElementById('file-input')?.click()
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Static SPA</p>
        <h1>GitHub Copilot Token Based Billing Report Viewer</h1>
        <p className="lede">
          Upload or drop a Copilot token billing CSV report to stream it and get a quick line count without loading the
          entire file into memory.
        </p>
      </header>

      <div
        className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          aria-label="Upload CSV report"
        />
        <div className="dropzone__content">
          <div className="dropzone__icon" aria-hidden>
            📄
          </div>
          <p className="dropzone__title">Drag &amp; drop your CSV here</p>
          <p className="dropzone__hint">or click to browse</p>
          <p className="dropzone__note">Streams 50k+ rows without blocking the UI.</p>
        </div>
      </div>

      <section className="results" aria-live="polite">
        <div className="result-row">
          <span className="label">Status</span>
          <span className="value">
            {status === 'processing' ? 'Processing…' : status === 'done' ? 'Done' : 'Waiting for a file'}
          </span>
        </div>
        {fileName && (
          <div className="result-row">
            <span className="label">File</span>
            <span className="value">{fileName}</span>
          </div>
        )}
        {lineCount !== null && (
          <div className="result-row">
            <span className="label">Total rows (excluding header)</span>
            <span className="value strong">{lineCount.toLocaleString()}</span>
          </div>
        )}
        {error && (
          <div className="error" role="status">
            <span>⚠️ {error}</span>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
