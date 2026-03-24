import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { CostBreakdownCard, DailyStackedBarChart, MultiSeriesStackedBarChart, SummaryCard, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { UserDetailsView } from './views/UserDetailsView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator } from './pipeline/aggregators/reportContextAggregator'
import { DailyUsageAggregator, type DailyUsageData } from './pipeline/aggregators/dailyUsageAggregator'
import { ModelUsageAggregator, type ModelDailyUsageData, type ModelUsageResult } from './pipeline/aggregators/modelUsageAggregator'
import { CostCenterAggregator, type CostCenterResult } from './pipeline/aggregators/costCenterAggregator'
import { OrganizationAggregator, type OrganizationResult } from './pipeline/aggregators/organizationAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { runPipeline } from './pipeline/runPipeline'

type Status = 'idle' | 'processing' | 'done'

type DatedMetric = {
  date: string
}

function formatUsd(n: number): string {
  return `$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatAiu(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

function fillDataForRange<T extends DatedMetric>(
  data: T[],
  startDate: string | null,
  endDate: string | null,
  createEmpty: (date: string) => T,
): T[] {
  if (!startDate || !endDate) return data

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return data

  const byDate = new Map<string, T>()
  for (const item of data) {
    byDate.set(item.date, item)
  }

  const out: T[] = []
  for (let current = start; current <= end; current = new Date(current.getTime() + 24 * 60 * 60 * 1000)) {
    const isoDate = current.toISOString().slice(0, 10)
    out.push(byDate.get(isoDate) ?? createEmpty(isoDate))
  }

  return out
}

function createEmptyDailyUsage(date: string): DailyUsageData {
  return {
    date,
    requests: 0,
    aiuQuantity: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

function createEmptyModelDailyUsage(date: string): ModelDailyUsageData {
  return {
    date,
    requests: 0,
    aiuQuantity: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportRange, setReportRange] = useState<{ startDate: string | null; endDate: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dailyUsageData, setDailyUsageData] = useState<DailyUsageData[]>([])
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'userDetails' | 'costCenters' | 'orgs'>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelUsage, setModelUsage] = useState<ModelUsageResult | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedUsername, setSelectedUsername] = useState<string>('')
  const [costCenters, setCostCenters] = useState<CostCenterResult | null>(null)
  const [orgs, setOrgs] = useState<OrganizationResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setQuickStats(null)
    setReportRange(null)
    setDailyUsageData([])
    setUserUsage(null)
    setModelUsage(null)
    setSelectedModel('')
    setSelectedUsername('')
    setCostCenters(null)
    setOrgs(null)
    setActiveView('overview')
    setFileName(file.name)

    try {
      const statsAggregator = new QuickStatsAggregator()
      const contextAggregator = new ReportContextAggregator()
      const dailyAggregator = new DailyUsageAggregator()
      const modelAggregator = new ModelUsageAggregator()
      const costCenterAggregator = new CostCenterAggregator()
      const orgAggregator = new OrganizationAggregator()
      const userAggregator = new UserUsageAggregator()

      await runPipeline(file, [
        statsAggregator,
        contextAggregator,
        dailyAggregator,
        modelAggregator,
        costCenterAggregator,
        orgAggregator,
        userAggregator,
      ])

      setQuickStats(statsAggregator.result())
      setReportRange(contextAggregator.result())
      setDailyUsageData(dailyAggregator.result().dailyData)

      const nextModelUsage = modelAggregator.result()
      setModelUsage(nextModelUsage)
      setSelectedModel(nextModelUsage.models[0] ?? '')

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
  const rangeStart = reportRange?.startDate ?? null
  const rangeEnd = reportRange?.endDate ?? null

  const filledDailyUsageData = fillDataForRange(dailyUsageData, rangeStart, rangeEnd, createEmptyDailyUsage)
  const perModelDailyData = selectedModel && modelUsage ? (modelUsage.byModel[selectedModel] ?? []) : []
  const filledPerModelDailyData = fillDataForRange(perModelDailyData, rangeStart, rangeEnd, createEmptyModelDailyUsage)

  const selectedModelTotals = selectedModel && modelUsage ? modelUsage.totalsByModel[selectedModel] : null
  const selectedUser = selectedUsername && userUsage
    ? userUsage.users.find((user) => user.username === selectedUsername) ?? null
    : null

  const overviewTotals = dailyUsageData.reduce(
    (totals, day) => {
      totals.requests += day.requests
      totals.aiuQuantity += day.aiuQuantity
      totals.grossAmount += day.grossAmount
      totals.discountAmount += day.discountAmount
      totals.netAmount += day.netAmount
      return totals
    },
    { requests: 0, aiuQuantity: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 },
  )

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

      <header className="primary-header">
        <h1 className="primary-header__title">GitHub Copilot Usage Billing Report Viewer</h1>
      </header>

      {hasReport ? (
        <>
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
                <button
                  className="secondary-header__button"
                  onClick={() => {
                    if (activeView === 'userDetails') {
                      setActiveView('users')
                    } else {
                      setActiveView('overview')
                    }
                  }}
                >
                  {activeView === 'userDetails' ? 'Back to users' : 'Back'}
                </button>
              )}
              <button className="secondary-header__button" onClick={triggerFileDialog}>
                Upload another report
              </button>
            </div>
          </nav>

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

                {dailyUsageData.length > 0 && (
                  <section>
                    <CostBreakdownCard
                      items={[
                        { label: 'Requests', value: overviewTotals.requests.toLocaleString() },
                        { label: 'AI Credits', value: formatAiu(overviewTotals.aiuQuantity) },
                        { label: 'Gross Cost', value: formatUsd(overviewTotals.grossAmount) },
                        { label: 'Discounts', value: formatUsd(overviewTotals.discountAmount), variant: 'muted' },
                        { label: 'Net Cost', value: formatUsd(overviewTotals.netAmount), variant: 'highlight' },
                      ]}
                    />

                    <section className="charts-grid">
                      <MultiSeriesStackedBarChart
                        title="Daily Requests"
                        labels={filledDailyUsageData.map((day) => day.date)}
                        series={[
                          {
                            label: 'Requests',
                            color: '#6366f1',
                            data: filledDailyUsageData.map((day) => day.requests),
                          },
                        ]}
                        height={320}
                      />
                      <MultiSeriesStackedBarChart
                        title="Daily AI Credits"
                        labels={filledDailyUsageData.map((day) => day.date)}
                        series={[
                          {
                            label: 'AI Credits',
                            color: '#22c55e',
                            data: filledDailyUsageData.map((day) => day.aiuQuantity),
                          },
                        ]}
                        height={320}
                      />
                      <DailyStackedBarChart
                        title="Daily Gross Breakdown"
                        data={filledDailyUsageData.map((day) => ({
                          date: day.date,
                          primaryValue: day.discountAmount,
                          secondaryValue: day.netAmount,
                        }))}
                        primaryLabel="Discounts"
                        secondaryLabel="Net Cost"
                        primaryColor="#f59e0b"
                        secondaryColor="#06b6d4"
                        height={320}
                      />
                    </section>
                  </section>
                )}

                {modelUsage && modelUsage.models.length > 0 && (
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
                          onChange={(event) => setSelectedModel(event.target.value)}
                        >
                          {modelUsage.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>

                      {selectedModelTotals && (
                        <div className="per-model__summary">
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">Requests</span>
                            <span className="per-model__summary-value">{selectedModelTotals.requests.toLocaleString()}</span>
                          </div>
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">AI Credits</span>
                            <span className="per-model__summary-value">{formatAiu(selectedModelTotals.aiuQuantity)}</span>
                          </div>
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">Gross Cost</span>
                            <span className="per-model__summary-value">{formatUsd(selectedModelTotals.grossAmount)}</span>
                          </div>
                          <div className="per-model__summary-row">
                            <span className="per-model__summary-label">Discounts</span>
                            <span className="per-model__summary-value per-model__summary-value--muted">
                              {formatUsd(selectedModelTotals.discountAmount)}
                            </span>
                          </div>
                          <div className="per-model__summary-row per-model__summary-row--highlight">
                            <span className="per-model__summary-label">Net Cost</span>
                            <span className="per-model__summary-value per-model__summary-value--bold">
                              {formatUsd(selectedModelTotals.netAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedModel && filledPerModelDailyData.length > 0 && (
                      <div className="per-model__charts charts-grid">
                        <MultiSeriesStackedBarChart
                          title={`Daily Requests (${selectedModel})`}
                          labels={filledPerModelDailyData.map((day) => day.date)}
                          series={[
                            {
                              label: 'Requests',
                              color: '#6366f1',
                              data: filledPerModelDailyData.map((day) => day.requests),
                            },
                          ]}
                          height={320}
                        />
                        <MultiSeriesStackedBarChart
                          title={`Daily AI Credits (${selectedModel})`}
                          labels={filledPerModelDailyData.map((day) => day.date)}
                          series={[
                            {
                              label: 'AI Credits',
                              color: '#22c55e',
                              data: filledPerModelDailyData.map((day) => day.aiuQuantity),
                            },
                          ]}
                          height={320}
                        />
                        <DailyStackedBarChart
                          title={`Daily Gross Breakdown (${selectedModel})`}
                          data={filledPerModelDailyData.map((day) => ({
                            date: day.date,
                            primaryValue: day.discountAmount,
                            secondaryValue: day.netAmount,
                          }))}
                          primaryLabel="Discounts"
                          secondaryLabel="Net Cost"
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
              <UsersView
                users={userUsage?.users ?? []}
                onSelectUser={(username) => {
                  setSelectedUsername(username)
                  setActiveView('userDetails')
                }}
              />
            ) : activeView === 'userDetails' ? (
              <UserDetailsView user={selectedUser} onBack={() => setActiveView('users')} />
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
