import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { DualAxisLineChart, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { UserDetailsView } from './views/UserDetailsView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { ModelsView } from './views/ModelsView'
import { ReportGuideView } from './views/ReportGuideView'
import { FaqView } from './views/FaqView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator, type ReportContextResult } from './pipeline/aggregators/reportContextAggregator'
import { DailyUsageAggregator, type DailyUsageData } from './pipeline/aggregators/dailyUsageAggregator'
import { ModelUsageAggregator, type ModelUsageResult } from './pipeline/aggregators/modelUsageAggregator'
import { CostCenterAggregator, type CostCenterResult } from './pipeline/aggregators/costCenterAggregator'
import { OrganizationAggregator, type OrganizationResult } from './pipeline/aggregators/organizationAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { runPipeline } from './pipeline/runPipeline'
import { fillDataForRange } from './utils/fillDataForRange'
import { formatAiu, formatUsd } from './utils/format'

type Status = 'idle' | 'processing' | 'done'

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
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'userDetails' | 'costCenters' | 'orgs' | 'models' | 'guide' | 'faq'>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelUsage, setModelUsage] = useState<ModelUsageResult | null>(null)
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

      <header className="site-header">
        <div className="site-header__left">
          <svg className="site-header__logo" height="32" viewBox="0 0 16 16" width="32" fill="#fff" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          <span className="site-header__title">Billing Preview</span>
        </div>
        {hasReport && (
          <div className="site-header__right">
            <button className="site-header__button" onClick={triggerFileDialog}>
              Upload another report
            </button>
          </div>
        )}
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
          </nav>

          <div className="app-layout">
            <aside className="sidebar" aria-label="Navigation">
              <nav className="sidebar__nav">
                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'overview' ? 'sidebar__item--active' : ''}`}
                  onClick={() => setActiveView('overview')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
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
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                  <span className="sidebar__label">Users</span>
                </button>

                {modelUsage && modelUsage.models.length > 0 && (
                  <button
                    type="button"
                    className={`sidebar__item ${activeView === 'models' ? 'sidebar__item--active' : ''}`}
                    onClick={() => setActiveView('models')}
                  >
                    <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d="M12 2L2 7l10 5 10-5-10-5Z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    <span className="sidebar__label">Models</span>
                  </button>
                )}

                {orgs && orgs.organizations.length > 0 && (
                  <button
                    type="button"
                    className={`sidebar__item ${activeView === 'orgs' ? 'sidebar__item--active' : ''}`}
                    onClick={() => setActiveView('orgs')}
                  >
                    <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
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
                    <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d="M12 3C8.5 3 6 5 6 7c0 2 2.5 4 6 4s6-2 6-4c0-2-2.5-4-6-4Z" />
                      <path d="M6 7v4c0 2 2.5 4 6 4s6-2 6-4V7" />
                      <path d="M6 11v4c0 2 2.5 4 6 4s6-2 6-4v-4" />
                    </svg>
                    <span className="sidebar__label">Cost Centers</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'guide' ? 'sidebar__item--active' : ''}`}
                  onClick={() => setActiveView('guide')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span className="sidebar__label">Report Format</span>
                </button>

                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'faq' ? 'sidebar__item--active' : ''}`}
                  onClick={() => setActiveView('faq')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                  </svg>
                  <span className="sidebar__label">FAQ</span>
                </button>
              </nav>
            </aside>

            <main className="report-content">
            {activeView === 'overview' ? (
              <div className="overview-page">
                <section className="report-summary" aria-live="polite">
                  {error && (
                    <div className="error" role="status">
                      <span>⚠️ {error}</span>
                    </div>
                  )}
                </section>

                {dailyUsageData.length > 0 && (
                  <section>
                    <div className="context-banner">
                      <h2 className="context-banner__title">GitHub Copilot is moving to token-based billing</h2>
                      <p className="context-banner__body">
                        Starting May 1, Copilot usage will be measured in AI Credits (AICs) instead of Premium Requests (PRUs). <strong className="aiu-callout">1 AIC = $0.01.</strong> This preview shows what your usage would look like under the new pricing.
                      </p>
                      {fileName && (
                        <p className="context-banner__note">
                          Note: This is a preview estimate based on your uploaded report ({fileName}). Actual bills under token-based pricing may differ based on model mix and final pricing.
                        </p>
                      )}
                      <a
                        href="https://docs.github.com/billing/managing-your-copilot-usage"
                        className="context-banner__link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more about token-based billing &rarr;
                      </a>
                    </div>

                    {(() => {
                      const savings = overviewTotals.netAmount - aicNetCost
                      const periodLabel = rangeStart
                        ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
                        : null
                      return savings > 0 && periodLabel ? (
                        <p className="comparison-framing">
                          Your <strong>{periodLabel}</strong> usage would cost{' '}
                          <strong>{formatUsd(savings)} less</strong> under token-based pricing
                        </p>
                      ) : null
                    })()}

                    <div className="comparison-grid">
                      <div className="card comparison-card">
                        <div className="comparison-card__label">Current billing (PRUs)</div>
                        <div className="comparison-card__big-number">{formatUsd(overviewTotals.netAmount)}</div>
                        <div className="comparison-card__period">{overviewTotals.requests.toLocaleString()} PRUs</div>
                        <div className="comparison-card__rate">1 PRU = $0.04</div>
                        <div className="comparison-card__breakdown">
                          <div className="comparison-card__breakdown-row">
                            <span>Gross cost</span>
                            <span>{formatUsd(overviewTotals.grossAmount)}</span>
                          </div>
                          <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                            <span>Discounts</span>
                            <span>−{formatUsd(overviewTotals.discountAmount)}</span>
                          </div>
                          <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                            <span>Net cost</span>
                            <span>{formatUsd(overviewTotals.netAmount)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="card comparison-card">
                        <div className="comparison-card__label">Token-based billing (AICs)</div>
                        <div className="comparison-card__big-number comparison-card__big-number--aiu">{formatUsd(aicNetCost)}</div>
                        <div className="comparison-card__period">{formatAiu(overviewTotals.aiuQuantity)} AICs</div>
                        <div className="comparison-card__rate">1 AIC = $0.01</div>
                        <div className="comparison-card__breakdown">
                          <div className="comparison-card__breakdown-row">
                            <span>Gross cost</span>
                            <span>{formatUsd(overviewTotals.aiuGrossAmount)}</span>
                          </div>
                          <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                            <span>Included credits discount</span>
                            <span>−{formatUsd(aicDiscount)}</span>
                          </div>
                          <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                            <span>Net cost</span>
                            <span>{formatUsd(aicNetCost)}</span>
                          </div>
                        </div>
                      </div>
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
                        title="Daily cost: PRU cost vs AIC cost"
                        labels={filledDailyUsageData.map((day) => day.date)}
                        series={[
                          {
                            label: 'PRU Gross Cost',
                            color: '#cf222e',
                            data: filledDailyUsageData.map((day) => day.grossAmount),
                            yAxisID: 'y',
                          },
                          {
                            label: 'AIC Gross Cost',
                            color: '#54aeff',
                            data: filledDailyUsageData.map((day) => day.aiuGrossAmount),
                            yAxisID: 'y',
                          },
                        ]}
                        formatYAsCurrency
                        height={320}
                      />
                    </section>

                    <div className="entitlement-banner">
                      <div className="entitlement-banner__body">
                        <strong className="entitlement-banner__title">Pooled entitlements are coming</strong>
                        <p className="entitlement-banner__text">
                          Under token-based billing, entitlements will be pooled across all licensed users in your organization. No more unused capacity going to waste from idle users.
                        </p>
                      </div>
                      <a
                        href="https://docs.github.com/billing/managing-your-copilot-usage"
                        className="entitlement-banner__link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more &rarr;
                      </a>
                    </div>

                    <section className="next-steps">
                      <h2 className="next-steps__heading">Recommended next steps</h2>
                      <div className="next-steps__grid">
                        <div className="next-steps__card">
                          <h3 className="next-steps__card-title">Set an account-level budget</h3>
                          <p className="next-steps__card-body">Control your total Copilot costs and prevent overages across your account. A top-level budget ensures spending stays within the limits you set.</p>
                          <a href="https://github.com/settings/billing/budgets/new" className="next-steps__cta next-steps__cta--primary" target="_blank" rel="noopener noreferrer">Set account budget &rarr;</a>
                        </div>
                        <div className="next-steps__card">
                          <h3 className="next-steps__card-title">Set per-user budgets</h3>
                          <p className="next-steps__card-body">Ensure every user gets the access they need while you control how entitlements are distributed. User-level budgets prevent any single person from consuming an outsized share of the pool.</p>
                          <a href="https://github.com/settings/billing/budgets" className="next-steps__cta" target="_blank" rel="noopener noreferrer">Manage user budgets &rarr;</a>
                        </div>
                        <div className="next-steps__card">
                          <h3 className="next-steps__card-title">Set product-level budgets</h3>
                          <p className="next-steps__card-body">Your usage breakdown shows cost by product. Set budgets per product (e.g., Coding Agent, Copilot Chat) to control spending where it matters most.</p>
                          <a href="https://github.com/settings/billing/budgets" className="next-steps__cta" target="_blank" rel="noopener noreferrer">Set product budgets &rarr;</a>
                        </div>
                        <div className="next-steps__card">
                          <h3 className="next-steps__card-title">Read the docs</h3>
                          <p className="next-steps__card-body">Learn how token-based billing works and how to plan for the transition.</p>
                          <a href="https://docs.github.com/billing" className="next-steps__cta" target="_blank" rel="noopener noreferrer">View documentation &rarr;</a>
                        </div>
                      </div>
                    </section>
                  </section>
                )}

              </div>
            ) : activeView === 'models' ? (
              modelUsage && modelUsage.models.length > 0 ? (
                <div className="view-content">
                  <ModelsView
                    modelUsage={modelUsage}
                    aicDiscountRate={aicDiscountRate}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                  />
                </div>
              ) : null
            ) : activeView === 'users' ? (
              <div className="view-content">
                <UsersView
                  users={userUsage?.users ?? []}
                  onSelectUser={(username) => {
                    setSelectedUsername(username)
                    setActiveView('userDetails')
                  }}
                />
              </div>
            ) : activeView === 'userDetails' ? (
              <div className="view-content">
                <UserDetailsView user={selectedUser} />
              </div>
            ) : activeView === 'costCenters' ? (
              <div className="view-content">
                <CostCentersView data={costCenters ?? { costCenters: [] }} rangeStart={rangeStart} />
              </div>
            ) : activeView === 'guide' ? (
              <div className="view-content">
                <ReportGuideView />
              </div>
            ) : activeView === 'faq' ? (
              <div className="view-content">
                <FaqView />
              </div>
            ) : (
              <div className="view-content">
                <OrganizationsView data={orgs ?? { organizations: [] }} />
              </div>
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

      {hasReport && (
        <footer className="site-footer">
          This is a preview based on your uploaded usage data. Actual bills may differ.<br />
          Your data never leaves your browser.{' '}
          Questions? <a href="https://support.github.com" target="_blank" rel="noopener noreferrer">Contact GitHub Support</a>.
        </footer>
      )}
    </div>
  )
}

export default App
