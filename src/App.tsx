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
    <div className={`app ${hasReport ? 'app--review' : ''}`}>
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        aria-label="Upload CSV report"
        style={{ display: 'none' }}
      />

      {/* Primary header - black bar */}
      <header className="primary-header">
        <h1 className="primary-header__title">GitHub Copilot Token Based Billing Report Viewer</h1>
      </header>

      {hasReport ? (
        <>
          {/* Secondary header - white bar with report info */}
          <nav className="secondary-header">
            <div className="secondary-header__info">
              <span className="secondary-header__label">File:</span>
              <span className="secondary-header__value">{fileName ?? 'Processing…'}</span>
              {reportRange && (reportRange.startDate || reportRange.endDate) && (
                <>
                  <span className="secondary-header__separator">|</span>
                  <span className="secondary-header__label">Report window:</span>
                  <span className="secondary-header__value">
                    {reportRange.startDate ?? '—'} to {reportRange.endDate ?? '—'}
                  </span>
                </>
              )}
              {status === 'processing' && (
                <>
                  <span className="secondary-header__separator">|</span>
                  <span className="secondary-header__status">Processing…</span>
                </>
              )}
            </div>
            <button className="secondary-header__button" onClick={triggerFileDialog}>
              Upload another report
            </button>
          </nav>

          {/* Main content area for charts and data */}
          <main className="report-content">
            <section className="report-summary" aria-live="polite">
              {lineCount !== null && (
                <div className="summary-card">
                  <span className="summary-card__label">Total rows</span>
                  <span className="summary-card__value">{lineCount.toLocaleString()}</span>
                </div>
              )}
              {error && (
                <div className="error" role="status">
                  <span>⚠️ {error}</span>
                </div>
              )}
            </section>
          </main>
        </>
      ) : (
        <main className="upload-page">
          <div className="upload-content">
            <h2 className="upload-content__title">Upload a Report</h2>
            <p className="upload-content__description">
              Drop a Copilot token billing CSV report to stream it and analyze usage data.
            </p>
            <section
              className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
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
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  )
}

export default App
