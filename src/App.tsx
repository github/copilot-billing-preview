import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { DailyStackedBarChart, SummaryCard, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator } from './pipeline/aggregators/reportContextAggregator'
import { DailyTokenAggregator, type DailyTokenData } from './pipeline/aggregators/dailyTokenAggregator'
import { ModelTokenAggregator, type ModelTokenResult } from './pipeline/aggregators/modelTokenAggregator'
import { CostCenterAggregator, type CostCenterResult } from './pipeline/aggregators/costCenterAggregator'
import { OrganizationAggregator, type OrganizationResult } from './pipeline/aggregators/organizationAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { runPipeline } from './pipeline/runPipeline'
import {
  fetchModelPricingConfig,
  createCostCalculator,
  type CostCalculator,
} from './pipeline/costCalculator'

type Status = 'idle' | 'processing' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportRange, setReportRange] = useState<{ startDate: string | null; endDate: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dailyTokenData, setDailyTokenData] = useState<DailyTokenData[]>([])
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'costCenters' | 'orgs'>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelTokens, setModelTokens] = useState<ModelTokenResult | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [costCenters, setCostCenters] = useState<CostCenterResult | null>(null)
  const [orgs, setOrgs] = useState<OrganizationResult | null>(null)
  const costCalculatorRef = useRef<CostCalculator | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load pricing config on mount
  useEffect(() => {
    fetchModelPricingConfig()
      .then((config) => {
        costCalculatorRef.current = createCostCalculator(config)
      })
      .catch((err) => {
        console.error('Failed to load model pricing config:', err)
      })
  }, [])

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setQuickStats(null)
    setReportRange(null)
    setDailyTokenData([])
    setUserUsage(null)
    setModelTokens(null)
    setSelectedModel('')
    setCostCenters(null)
    setOrgs(null)
    setActiveView('overview')
    setFileName(file.name)

    try {
      const statsAggregator = new QuickStatsAggregator()
      const contextAggregator = new ReportContextAggregator()
      const tokenAggregator = new DailyTokenAggregator()
      const modelAggregator = new ModelTokenAggregator()
      const costCenterAggregator = new CostCenterAggregator()
      const orgAggregator = new OrganizationAggregator()
      const userAggregator = new UserUsageAggregator()
      await runPipeline(file, [statsAggregator, contextAggregator, tokenAggregator, modelAggregator, costCenterAggregator, orgAggregator, userAggregator])
      setQuickStats(statsAggregator.result())
      setReportRange(contextAggregator.result())
      setDailyTokenData(tokenAggregator.result().dailyData)

      const modelResult = modelAggregator.result()
      setModelTokens(modelResult)
      setSelectedModel(modelResult.models[0] ?? '')

      setCostCenters(costCenterAggregator.result())
      setOrgs(orgAggregator.result())
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

  const formatUsd = (n: number): string => {
    return `$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

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

  const selectedModelTotals = selectedModel && modelTokens ? modelTokens.totalsByModel[selectedModel] : null
  const selectedGross = selectedModelTotals?.grossAmount ?? 0
  const selectedNet = selectedModelTotals?.netAmount ?? 0
  const selectedIncluded = selectedGross - selectedNet

  // Calculate token-based cost and AI units for selected model
  const selectedModelCost = selectedModelTotals && costCalculatorRef.current
    ? costCalculatorRef.current.calculate(selectedModel, {
        inputTokens: selectedModelTotals.totalInputTokens,
        outputTokens: selectedModelTotals.totalOutputTokens,
        cacheReadTokens: selectedModelTotals.totalCacheReadTokens,
      })
    : null

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
              {activeView !== 'overview' && (
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
                      <SummaryCard label="Total rows" value={quickStats.lineCount.toLocaleString()} />
                      <SummaryCard
                        label="Users"
                        value={quickStats.userCount.toLocaleString()}
                        clickable
                        disabled={!userUsage}
                        onClick={() => {
                          if (userUsage) setActiveView('users')
                        }}
                      />
                      <SummaryCard
                        label="Organizations"
                        value={quickStats.orgCount.toLocaleString()}
                        clickable
                        disabled={!orgs || orgs.organizations.length === 0}
                        onClick={() => {
                          if (orgs && orgs.organizations.length > 0) setActiveView('orgs')
                        }}
                      />
                      <SummaryCard
                        label="Cost Centers"
                        value={quickStats.costCenterCount.toLocaleString()}
                        clickable
                        disabled={!costCenters || costCenters.costCenters.length === 0}
                        onClick={() => {
                          if (costCenters && costCenters.costCenters.length > 0) setActiveView('costCenters')
                        }}
                      />
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

                      {selectedModelTotals && (
                        <div className="per-model__summary">
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">Gross Cost</span>
                            <span className="per-model__summary-value">{formatUsd(selectedGross)}</span>
                          </div>
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">Included</span>
                            <span className="per-model__summary-value per-model__summary-value--muted">
                              {formatUsd(selectedIncluded)}
                            </span>
                          </div>
                          <div className="per-model__summary-row per-model__summary-row--highlight">
                            <span className="per-model__summary-label">Net Cost</span>
                            <span className="per-model__summary-value per-model__summary-value--bold">
                              {formatUsd(selectedNet)}
                            </span>
                          </div>
                          {selectedModelCost && (
                            <>
                              <div className="per-model__summary-row per-model__summary-row--divider" />
                              <div className="per-model__summary-row">
                                <span className="per-model__summary-label">Token-Based Cost</span>
                                <span className="per-model__summary-value">
                                  {formatUsd(selectedModelCost.totalCost)}
                                </span>
                              </div>
                              <div className="per-model__summary-row per-model__summary-row--highlight">
                                <span className="per-model__summary-label">AI Units</span>
                                <span className="per-model__summary-value per-model__summary-value--bold">
                                  {selectedModelCost.aiUnits.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <div className="per-model__summary-row">
                                <span className="per-model__summary-label">Token-Based Diff</span>
                                <span
                                  className={`per-model__summary-value per-model__summary-value--bold ${
                                    selectedModelCost.totalCost - selectedGross <= 0
                                      ? 'per-model__summary-value--positive'
                                      : 'per-model__summary-value--negative'
                                  }`}
                                >
                                  {formatUsd(selectedModelCost.totalCost - selectedGross)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedModel && filledPerModelDailyData.length > 0 && (
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
            ) : activeView === 'users' ? (
              <UsersView users={userUsage?.users ?? []} />
            ) : activeView === 'costCenters' ? (
              <CostCentersView data={costCenters ?? { costCenters: [] }} />
            ) : (
              <OrganizationsView data={orgs ?? { organizations: [] }} />
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
