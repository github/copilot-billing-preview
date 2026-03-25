import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { CostBreakdownCard, DualAxisLineChart, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { UserDetailsView } from './views/UserDetailsView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator, type ReportContextResult } from './pipeline/aggregators/reportContextAggregator'
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
    aiuGrossAmount: 0,
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
    aiuGrossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

// Current pooled AI Credits estimate based on Copilot plan assumptions in the billing export:
// quota >= 300 => 3,000 included credits, quota >= 1,000 => 7,000 included credits.
const INCLUDED_AIC_BY_MONTHLY_QUOTA = [
  { minimumQuota: 1000, includedCredits: 7000 },
  { minimumQuota: 300, includedCredits: 3000 },
] as const

function getIncludedAicCredits(totalMonthlyQuota: number): number {
  return INCLUDED_AIC_BY_MONTHLY_QUOTA.find((plan) => totalMonthlyQuota >= plan.minimumQuota)?.includedCredits ?? 0
}

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportContext, setReportContext] = useState<ReportContextResult | null>(null)
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
    setReportContext(null)
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
      setReportContext(contextAggregator.result())
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
  const rangeStart = reportContext?.startDate ?? null
  const rangeEnd = reportContext?.endDate ?? null

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
      totals.aiuGrossAmount += day.aiuGrossAmount
      totals.discountAmount += day.discountAmount
      totals.netAmount += day.netAmount
      return totals
    },
    { requests: 0, aiuQuantity: 0, grossAmount: 0, aiuGrossAmount: 0, discountAmount: 0, netAmount: 0 },
  )

  const pooledAicCredits = (userUsage?.users ?? []).reduce((sum, user) => sum + getIncludedAicCredits(user.totalMonthlyQuota), 0)

  const aicDiscountRate =
    overviewTotals.aiuQuantity > 0
      ? Math.min(pooledAicCredits / overviewTotals.aiuQuantity, 1)
      : 0
  const aicDiscount = aicDiscountRate * overviewTotals.aiuGrossAmount
  const aicNetCost = Math.max(overviewTotals.aiuGrossAmount - aicDiscount, 0)

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
              {reportContext && (reportContext.startDate || reportContext.endDate) && (
                <>
                  <span className="secondary-header__separator">|</span>
                  <span className="secondary-header__label">Report window:</span>
                  <span className="secondary-header__value">
                    {reportContext.startDate ?? '—'} to {reportContext.endDate ?? '—'}
                  </span>
                </>
              )}
              {quickStats && (
                <>
                  <span className="secondary-header__separator">|</span>
                  <span className="secondary-header__label">Total rows:</span>
                  <span className="secondary-header__value">{quickStats.lineCount.toLocaleString()}</span>
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
              <button className="secondary-header__button" onClick={triggerFileDialog}>
                Upload another report
              </button>
            </div>
          </nav>

          <div className="app-layout">
            <aside className="sidebar" aria-label="Navigation">
              <nav className="sidebar__nav">
                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'overview' ? 'sidebar__item--active' : ''}`}
                  onClick={() => setActiveView('overview')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span className="sidebar__label">Overview</span>
                </button>

                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'users' || activeView === 'userDetails' ? 'sidebar__item--active' : ''}`}
                  disabled={!userUsage}
                  onClick={() => setActiveView('users')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                  <span className="sidebar__label">Users</span>
                </button>

                {orgs && orgs.organizations.length > 0 && (
                  <button
                    type="button"
                    className={`sidebar__item ${activeView === 'orgs' ? 'sidebar__item--active' : ''}`}
                    onClick={() => setActiveView('orgs')}
                  >
                    <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="16" height="18" rx="1" />
                      <path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2" />
                    </svg>
                    <span className="sidebar__label">Organizations</span>
                  </button>
                )}

                {costCenters && costCenters.costCenters.length > 0 && (
                  <button
                    type="button"
                    className={`sidebar__item ${activeView === 'costCenters' ? 'sidebar__item--active' : ''}`}
                    onClick={() => setActiveView('costCenters')}
                  >
                    <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3C8.5 3 6 5 6 7c0 2 2.5 4 6 4s6-2 6-4c0-2-2.5-4-6-4Z" />
                      <path d="M6 7v4c0 2 2.5 4 6 4s6-2 6-4V7" />
                      <path d="M6 11v4c0 2 2.5 4 6 4s6-2 6-4v-4" />
                    </svg>
                    <span className="sidebar__label">Cost Centers</span>
                  </button>
                )}
              </nav>
            </aside>

            <main className="report-content">
            {activeView === 'overview' ? (
              <>
                <section className="report-summary" aria-live="polite">
                  {error && (
                    <div className="error" role="status">
                      <span>⚠️ {error}</span>
                    </div>
                  )}
                </section>

                {dailyUsageData.length > 0 && (
                  <section>
                    <div className="overview-cards">
                      <CostBreakdownCard
                        title="PRU Cost"
                        items={[
                          { label: 'Premium Requests', value: overviewTotals.requests.toLocaleString() },
                          { label: 'PRU Gross Cost', value: formatUsd(overviewTotals.grossAmount) },
                          { label: 'PRU Discounts', value: formatUsd(overviewTotals.discountAmount), variant: 'muted' },
                          { label: 'Net Cost', value: formatUsd(overviewTotals.netAmount), variant: 'highlight' },
                        ]}
                      />
                      <CostBreakdownCard
                        title="AIC Cost"
                        items={[
                          { label: 'AI Credits', value: formatAiu(overviewTotals.aiuQuantity) },
                          { label: 'AI Credits Gross Cost', value: formatUsd(overviewTotals.aiuGrossAmount) },
                          { label: 'AI Credits Discount', value: formatUsd(aicDiscount), variant: 'muted' },
                          { label: 'Net Cost', value: formatUsd(aicNetCost), variant: 'highlight' },
                        ]}
                      />

                      {(() => {
                        const pruCost = overviewTotals.netAmount
                        const aicCost = aicNetCost
                        const diff = aicCost - pruCost
                        const absDiff = Math.abs(diff)
                        const pctChange = pruCost !== 0 ? (diff / pruCost) * 100 : 0
                        const aicCheaper = diff < 0
                        const same = Math.abs(diff) < 0.01

                        return (
                          <div className="billing-comparison">
                            <h4 className="billing-comparison__title">Billing Comparison</h4>
                            <div className="billing-comparison__rows">
                              <div className="billing-comparison__row">
                                <span className="billing-comparison__label">Current (PRU net)</span>
                                <span className="billing-comparison__value">{formatUsd(pruCost)}</span>
                              </div>
                              <div className="billing-comparison__row">
                                <span className="billing-comparison__label">AI Credits (net)</span>
                                <span className="billing-comparison__value">{formatUsd(aicCost)}</span>
                              </div>
                              <div className="billing-comparison__divider" />
                              <div className="billing-comparison__row">
                                <span className="billing-comparison__label">Difference</span>
                                <span className={`billing-comparison__value ${same ? '' : aicCheaper ? 'billing-comparison__value--savings' : 'billing-comparison__value--overspend'}`}>
                                  {same ? '$0.00' : `${aicCheaper ? '−' : '+'}${formatUsd(absDiff)}`}
                                  {!same && pruCost !== 0 && (
                                    <span className="billing-comparison__pct">
                                      {` (${Math.abs(pctChange).toFixed(1)}%)`}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className={`billing-comparison__verdict ${same ? 'billing-comparison__verdict--neutral' : aicCheaper ? 'billing-comparison__verdict--savings' : 'billing-comparison__verdict--overspend'}`}>
                              <svg className="billing-comparison__verdict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {same ? (
                                  <><line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></>
                                ) : aicCheaper ? (
                                  <><polyline points="6 9 12 15 18 9" /></>
                                ) : (
                                  <><polyline points="6 15 12 9 18 15" /></>
                                )}
                              </svg>
                              <span className="billing-comparison__verdict-text">
                                {same
                                  ? 'AI Credits and PRU billing are equal'
                                  : aicCheaper
                                    ? 'AI Credits billing is cheaper than PRU'
                                    : 'AI Credits billing is more expensive than PRU'}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <section className="charts-grid">
                      <DualAxisLineChart
                        title="Daily Requests & AI Credits"
                        labels={filledDailyUsageData.map((day) => day.date)}
                        series={[
                          {
                            label: 'Premium Requests',
                            color: '#6366f1',
                            data: filledDailyUsageData.map((day) => day.requests),
                            yAxisID: 'y',
                          },
                          {
                            label: 'AI Credits',
                            color: '#22c55e',
                            data: filledDailyUsageData.map((day) => day.aiuQuantity),
                            yAxisID: 'y1',
                          },
                        ]}
                        height={320}
                      />
                      <DualAxisLineChart
                        title="Daily Gross Breakdown"
                        labels={filledDailyUsageData.map((day) => day.date)}
                        series={[
                          {
                            label: 'PRU Gross Cost',
                            color: '#f59e0b',
                            data: filledDailyUsageData.map((day) => day.grossAmount),
                            yAxisID: 'y',
                          },
                          {
                            label: 'AIC Gross Cost',
                            color: '#06b6d4',
                            data: filledDailyUsageData.map((day) => day.aiuGrossAmount),
                            yAxisID: 'y',
                          },
                        ]}
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
                        <div className="overview-cards">
                          <div className="per-model__summary">
                            <h4 className="cost-breakdown-card__title">PRU Cost</h4>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">Premium Requests</span>
                              <span className="per-model__summary-value">{selectedModelTotals.requests.toLocaleString()}</span>
                            </div>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">PRU Gross Cost</span>
                              <span className="per-model__summary-value">{formatUsd(selectedModelTotals.grossAmount)}</span>
                            </div>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">PRU Discounts</span>
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

                          <div className="per-model__summary">
                            <h4 className="cost-breakdown-card__title">AIC Cost</h4>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">AI Credits</span>
                              <span className="per-model__summary-value">{formatAiu(selectedModelTotals.aiuQuantity)}</span>
                            </div>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">AI Credits Gross Cost</span>
                              <span className="per-model__summary-value">{formatUsd(selectedModelTotals.aiuGrossAmount)}</span>
                            </div>
                            <div className="per-model__summary-row">
                              <span className="per-model__summary-label">AI Credits Discount</span>
                              <span className="per-model__summary-value per-model__summary-value--muted">
                                {formatUsd(0)}
                              </span>
                            </div>
                            <div className="per-model__summary-row per-model__summary-row--highlight">
                              <span className="per-model__summary-label">Net Cost</span>
                              <span className="per-model__summary-value per-model__summary-value--bold">
                                {formatUsd(selectedModelTotals.aiuGrossAmount)}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const pruCost = selectedModelTotals.grossAmount
                            const aicCost = selectedModelTotals.aiuGrossAmount
                            const diff = aicCost - pruCost
                            const absDiff = Math.abs(diff)
                            const pctChange = pruCost !== 0 ? (diff / pruCost) * 100 : 0
                            const aicCheaper = diff < 0
                            const same = Math.abs(diff) < 0.01

                            return (
                              <div className="billing-comparison">
                                <h4 className="billing-comparison__title">Model Billing Comparison</h4>
                                <div className="billing-comparison__rows">
                                  <div className="billing-comparison__row">
                                    <span className="billing-comparison__label">Current (PRU)</span>
                                    <span className="billing-comparison__value">{formatUsd(pruCost)}</span>
                                  </div>
                                  <div className="billing-comparison__row">
                                    <span className="billing-comparison__label">AI Credits (new)</span>
                                    <span className="billing-comparison__value">{formatUsd(aicCost)}</span>
                                  </div>
                                  <div className="billing-comparison__divider" />
                                  <div className="billing-comparison__row">
                                    <span className="billing-comparison__label">Difference</span>
                                    <span className={`billing-comparison__value ${same ? '' : aicCheaper ? 'billing-comparison__value--savings' : 'billing-comparison__value--overspend'}`}>
                                      {same ? '$0.00' : `${aicCheaper ? '−' : '+'}${formatUsd(absDiff)}`}
                                      {!same && pruCost !== 0 && (
                                        <span className="billing-comparison__pct">
                                          {` (${Math.abs(pctChange).toFixed(1)}%)`}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                                <div className={`billing-comparison__verdict ${same ? 'billing-comparison__verdict--neutral' : aicCheaper ? 'billing-comparison__verdict--savings' : 'billing-comparison__verdict--overspend'}`}>
                                  <svg className="billing-comparison__verdict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {same ? (
                                      <><line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></>
                                    ) : aicCheaper ? (
                                      <><polyline points="6 9 12 15 18 9" /></>
                                    ) : (
                                      <><polyline points="6 15 12 9 18 15" /></>
                                    )}
                                  </svg>
                                  <span className="billing-comparison__verdict-text">
                                    {same
                                      ? 'AI Credits and PRU billing are equal'
                                      : aicCheaper
                                        ? 'AI Credits billing is cheaper for this model'
                                        : 'AI Credits billing is more expensive for this model'}
                                  </span>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    {selectedModel && filledPerModelDailyData.length > 0 && (
                      <div className="per-model__charts charts-grid">
                        <DualAxisLineChart
                          title={`Daily Requests & AI Credits (${selectedModel})`}
                          labels={filledPerModelDailyData.map((day) => day.date)}
                          series={[
                            {
                              label: 'Premium Requests',
                              color: '#6366f1',
                              data: filledPerModelDailyData.map((day) => day.requests),
                              yAxisID: 'y',
                            },
                            {
                              label: 'AI Credits',
                              color: '#22c55e',
                              data: filledPerModelDailyData.map((day) => day.aiuQuantity),
                              yAxisID: 'y1',
                            },
                          ]}
                          height={320}
                        />
                        <DualAxisLineChart
                          title={`Daily Gross Breakdown (${selectedModel})`}
                          labels={filledPerModelDailyData.map((day) => day.date)}
                          series={[
                          {
                            label: 'PRU Gross Cost',
                            color: '#f59e0b',
                            data: filledPerModelDailyData.map((day) => day.grossAmount),
                            yAxisID: 'y',
                          },
                          {
                            label: 'AIC Gross Cost',
                            color: '#06b6d4',
                            data: filledPerModelDailyData.map((day) => day.aiuGrossAmount),
                            yAxisID: 'y',
                          },
                        ]}
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
              <UserDetailsView user={selectedUser} />
            ) : activeView === 'costCenters' ? (
              <CostCentersView data={costCenters ?? { costCenters: [] }} />
            ) : (
              <OrganizationsView data={orgs ?? { organizations: [] }} />
            )}
          </main>
          </div>
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
