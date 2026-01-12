import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { LineCountAggregator } from './pipeline/aggregators/lineCountAggregator'
import { ReportContextAggregator } from './pipeline/aggregators/reportContextAggregator'
import { runPipeline } from './pipeline/runPipeline'

type Status = 'idle' | 'processing' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [lineCount, setLineCount] = useState<number | null>(null)
  const [reportRange, setReportRange] = useState<{ startDate: string | null; endDate: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setLineCount(null)
    setReportRange(null)
    setFileName(file.name)

    try {
      const countAggregator = new LineCountAggregator()
      const contextAggregator = new ReportContextAggregator()
      await runPipeline(file, [countAggregator, contextAggregator])
      setLineCount(countAggregator.result().lineCount)
      setReportRange(contextAggregator.result())
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

  const triggerFileDialog = (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault()
    fileInputRef.current?.click()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      triggerFileDialog(event)
    }
  }

  const hasReport = fileName !== null || status === 'processing'

  return (
    <main className="page">
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        aria-label="Upload CSV report"
        style={{ display: 'none' }}
      />

      <header className="page-header">
        <p className="eyebrow">Static SPA</p>
        <h1>GitHub Copilot Token Based Billing Report Viewer</h1>
        <p className="lede">
          Upload or drop a Copilot token billing CSV report to stream it and get a quick line count without loading the
          entire file into memory.
        </p>
      </header>

      {!hasReport ? (
        <section
          className={`panel dropzone ${dragActive ? 'dropzone--active' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={triggerFileDialog}
          role="button"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <div className="dropzone__content">
            <div className="dropzone__icon" aria-hidden>
              📄
            </div>
            <p className="dropzone__title">Drag &amp; drop your CSV here</p>
            <p className="dropzone__hint">or click to browse</p>
            <p className="dropzone__note">Streams 50k+ rows without blocking the UI.</p>
          </div>
        </section>
      ) : (
        <section className="panel viewer">
          <div className="viewer__header">
            <div>
              <p className="eyebrow">Report viewer</p>
              <h2 className="viewer__title">{fileName ?? 'Processing report…'}</h2>
              <p className="viewer__subtitle">
                {status === 'processing'
                  ? 'Streaming and parsing your CSV…'
                  : 'Parsed with streaming pipeline (header + data rows).'}
              </p>
            </div>
            <button className="ghost-button" onClick={triggerFileDialog}>
              Upload another report
            </button>
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
            {reportRange && (reportRange.startDate || reportRange.endDate) && (
              <div className="result-row">
                <span className="label">Report window</span>
                <span className="value">
                  {reportRange.startDate ?? '—'} to {reportRange.endDate ?? '—'}
                </span>
              </div>
            )}
            {error && (
              <div className="error" role="status">
                <span>⚠️ {error}</span>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  )
}

export default App
