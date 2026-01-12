import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { DailyStackedBarChart, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator } from './pipeline/aggregators/reportContextAggregator'
import { DailyTokenAggregator, type DailyTokenData } from './pipeline/aggregators/dailyTokenAggregator'
import { ModelTokenAggregator, type ModelTokenResult } from './pipeline/aggregators/modelTokenAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { runPipeline } from './pipeline/runPipeline'

type Status = 'idle' | 'processing' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportRange, setReportRange] = useState<{ startDate: string | null; endDate: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dailyTokenData, setDailyTokenData] = useState<DailyTokenData[]>([])
  const [activeView, setActiveView] = useState<'overview' | 'users'>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelTokens, setModelTokens] = useState<ModelTokenResult | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setQuickStats(null)
    setReportRange(null)
    setDailyTokenData([])
    setUserUsage(null)
    setModelTokens(null)
    setSelectedModel('')
    setActiveView('overview')
    setFileName(file.name)

    try {
      const statsAggregator = new QuickStatsAggregator()
      const contextAggregator = new ReportContextAggregator()
      const tokenAggregator = new DailyTokenAggregator()
      const modelAggregator = new ModelTokenAggregator()
      const userAggregator = new UserUsageAggregator()
      await runPipeline(file, [statsAggregator, contextAggregator, tokenAggregator, modelAggregator, userAggregator])
      setQuickStats(statsAggregator.result())
      setReportRange(contextAggregator.result())
      setDailyTokenData(tokenAggregator.result().dailyData)

      const modelResult = modelAggregator.result()
      setModelTokens(modelResult)
      setSelectedModel(modelResult.models[0] ?? '')

      setUserUsage(userAggregator.result())
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

  const perModelDailyData = selectedModel && modelTokens ? (modelTokens.byModel[selectedModel] ?? []) : []

  const fillTokenDataForRange = <T extends {
    date: string
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheCreationTokens: number
    totalCacheReadTokens: number
  }>(
    data: T[],
    startDate: string | null,
    endDate: string | null,
  ): T[] => {
    if (!startDate || !endDate) return data

    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(`${endDate}T00:00:00Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return data

    const byDate = new Map<string, T>()
    for (const d of data) {
      byDate.set(d.date, d)
    }

    const out: T[] = []
    for (let cur = start; cur <= end; cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)) {
      const iso = cur.toISOString().slice(0, 10)
      const existing = byDate.get(iso)
      if (existing) {
        out.push(existing)
      } else {
        out.push({
          date: iso,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheCreationTokens: 0,
          totalCacheReadTokens: 0,
        } as T)
      }
    }

    return out
  }

  const rangeStart = reportRange?.startDate ?? null
  const rangeEnd = reportRange?.endDate ?? null

  const filledTotalDailyTokenData = fillTokenDataForRange(dailyTokenData, rangeStart, rangeEnd)
  const filledPerModelDailyData = fillTokenDataForRange(perModelDailyData, rangeStart, rangeEnd)

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
            <div className="secondary-header__actions">
              {activeView === 'users' && (
                <button className="secondary-header__button" onClick={() => setActiveView('overview')}>
                  Back
                </button>
              )}
              <button className="secondary-header__button" onClick={triggerFileDialog}>
                Upload another report
              </button>
            </div>
          </nav>

          {/* Main content area for charts and data */}
          <main className="report-content">
            {activeView === 'overview' ? (
              <>
                <section className="report-summary" aria-live="polite">
                  {quickStats && (
                    <>
                      <div className="summary-card">
                        <span className="summary-card__label">Total rows</span>
                        <span className="summary-card__value">{quickStats.lineCount.toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        className="summary-card summary-card--clickable"
                        disabled={!userUsage}
                        onClick={() => {
                          if (userUsage) setActiveView('users')
                        }}
                      >
                        <div className="summary-card__header">
                          <span className="summary-card__label">Users</span>
                          <span className="summary-card__chevron" aria-hidden>
                            &gt;
                          </span>
                        </div>
                        <span className="summary-card__value">{quickStats.userCount.toLocaleString()}</span>
                      </button>
                      <div className="summary-card">
                        <span className="summary-card__label">Organizations</span>
                        <span className="summary-card__value">{quickStats.orgCount.toLocaleString()}</span>
                      </div>
                      <div className="summary-card">
                        <span className="summary-card__label">Cost Centers</span>
                        <span className="summary-card__value">{quickStats.costCenterCount.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  {error && (
                    <div className="error" role="status">
                      <span>⚠️ {error}</span>
                    </div>
                  )}
                </section>

                {dailyTokenData.length > 0 && (
                  <section className="charts-grid">
                    <DailyStackedBarChart
                      title="Daily Input/Output Tokens"
                      data={filledTotalDailyTokenData.map((d) => ({
                        date: d.date,
                        primaryValue: d.totalInputTokens,
                        secondaryValue: d.totalOutputTokens,
                      }))}
                      primaryLabel="Input Tokens"
                      secondaryLabel="Output Tokens"
                      primaryColor="#6366f1"
                      secondaryColor="#22c55e"
                      height={320}
                    />
                    <DailyStackedBarChart
                      title="Daily Cache Tokens"
                      data={filledTotalDailyTokenData.map((d) => ({
                        date: d.date,
                        primaryValue: d.totalCacheCreationTokens,
                        secondaryValue: d.totalCacheReadTokens,
                      }))}
                      primaryLabel="Cache Creation"
                      secondaryLabel="Cache Read"
                      primaryColor="#f59e0b"
                      secondaryColor="#06b6d4"
                      height={320}
                    />
                  </section>
                )}

                {modelTokens && modelTokens.models.length > 0 && (
                  <section className="per-model" aria-label="Per-Model Breakdown">
                    <div className="per-model__header">
                      <h3 className="per-model__title">Per-Model Breakdown</h3>
                    </div>
                    <div className="per-model__controls">
                      <label className="per-model__label">
                        Model
                        <select
                          className="per-model__select"
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                        >
                          {modelTokens.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {selectedModel && perModelDailyData.length > 0 && (
                      <div className="per-model__charts charts-grid">
                        <DailyStackedBarChart
                          title={`Daily Input/Output Tokens (${selectedModel})`}
                          data={filledPerModelDailyData.map((d) => ({
                            date: d.date,
                            primaryValue: d.totalInputTokens,
                            secondaryValue: d.totalOutputTokens,
                          }))}
                          primaryLabel="Input Tokens"
                          secondaryLabel="Output Tokens"
                          primaryColor="#6366f1"
                          secondaryColor="#22c55e"
                          height={320}
                        />
                        <DailyStackedBarChart
                          title={`Daily Cache Tokens (${selectedModel})`}
                          data={filledPerModelDailyData.map((d) => ({
                            date: d.date,
                            primaryValue: d.totalCacheCreationTokens,
                            secondaryValue: d.totalCacheReadTokens,
                          }))}
                          primaryLabel="Cache Creation"
                          secondaryLabel="Cache Read"
                          primaryColor="#f59e0b"
                          secondaryColor="#06b6d4"
                          height={320}
                        />
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <UsersView users={userUsage?.users ?? []} />
            )}
          </main>
        </>
      ) : (
        <UploadPage
          dragActive={dragActive}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClickDropzone={triggerFileDialog}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  )
}

export default App
