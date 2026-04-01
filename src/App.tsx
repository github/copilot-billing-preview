import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import './App.css'
import { UploadPage } from './components'
import { UsersView } from './views/UsersView'
import { UserDetailsView } from './views/UserDetailsView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { ModelsView } from './views/ModelsView'
import { ReportGuideView } from './views/ReportGuideView'
import { FaqView } from './views/FaqView'
import { ProductsView } from './views/ProductsView'
import { OverviewView } from './views/OverviewView'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator, type ReportContextResult } from './pipeline/aggregators/reportContextAggregator'
import { DailyUsageAggregator, type DailyUsageData } from './pipeline/aggregators/dailyUsageAggregator'
import { ModelUsageAggregator, type ModelUsageResult } from './pipeline/aggregators/modelUsageAggregator'
import { ProductUsageAggregator, type ProductUsageResult } from './pipeline/aggregators/productUsageAggregator'
import { CostCenterAggregator, type CostCenterResult } from './pipeline/aggregators/costCenterAggregator'
import { OrganizationAggregator, type OrganizationResult } from './pipeline/aggregators/organizationAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { getMonthlyAicEntitlements } from './pipeline/aicEntitlements'
import { runPipeline } from './pipeline/runPipeline'
import { calculateOverviewAicDiscountRate } from './utils/overviewBilling'
import { calculateCostOptimizationOpportunity } from './utils/costOptimization'

type Status = 'idle' | 'processing' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportContext, setReportContext] = useState<ReportContextResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dailyUsageData, setDailyUsageData] = useState<DailyUsageData[]>([])
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'userDetails' | 'costCenters' | 'orgs' | 'models' | 'products' | 'guide' | 'faq'>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelUsage, setModelUsage] = useState<ModelUsageResult | null>(null)
  const [productUsage, setProductUsage] = useState<ProductUsageResult | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string>('')
  const [costCenters, setCostCenters] = useState<CostCenterResult | null>(null)
  const [orgs, setOrgs] = useState<OrganizationResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [rowsProcessed, setRowsProcessed] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleProcess = useCallback(async (file: File) => {
    setStatus('processing')
    setError(null)
    setQuickStats(null)
    setReportContext(null)
    setDailyUsageData([])
    setUserUsage(null)
    setModelUsage(null)
    setProductUsage(null)
    setSelectedUsername('')
    setCostCenters(null)
    setOrgs(null)
    setActiveView('overview')
    setFileName(file.name)
    setProgress(0)
    setRowsProcessed(0)

    try {
      const statsAggregator = new QuickStatsAggregator()
      const contextAggregator = new ReportContextAggregator()
      const dailyAggregator = new DailyUsageAggregator()
      const modelAggregator = new ModelUsageAggregator()
      const productAggregator = new ProductUsageAggregator()
      const costCenterAggregator = new CostCenterAggregator()
      const orgAggregator = new OrganizationAggregator()
      const userAggregator = new UserUsageAggregator()

      await runPipeline(file, [
        statsAggregator,
        contextAggregator,
        dailyAggregator,
        modelAggregator,
        productAggregator,
        costCenterAggregator,
        orgAggregator,
        userAggregator,
      ], {
        progressResolution: 500,
        onProgress: (progressInfo) => {
          setRowsProcessed(progressInfo.rowsProcessed)
          setProgress((prev) => Math.min(prev + 5, 90))
        },
      })

      setProgress(100)
      setQuickStats(statsAggregator.result())
      setReportContext(contextAggregator.result())
      setDailyUsageData(dailyAggregator.result().dailyData)

      const nextModelUsage = modelAggregator.result()
      setModelUsage(nextModelUsage)
      setProductUsage(productAggregator.result())

      setCostCenters(costCenterAggregator.result())
      setOrgs(orgAggregator.result())
      setUserUsage(userAggregator.result())
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process the report.')
      setStatus('idle')
      setProgress(0)
      setRowsProcessed(0)
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

  const hasReport = status === 'done' && fileName !== null
  const rangeStart = reportContext?.startDate ?? null
  const rangeEnd = reportContext?.endDate ?? null

  const selectedUser = selectedUsername && userUsage
    ? userUsage.users.find((user) => user.username === selectedUsername) ?? null
    : null

  const pooledAicCredits = (userUsage?.users ?? []).reduce((sum, user) => sum + getMonthlyAicEntitlements(user.totalMonthlyQuota), 0)
  const aicDiscountRate = calculateOverviewAicDiscountRate(dailyUsageData, pooledAicCredits)
  const overviewAicNetAmount = dailyUsageData.reduce((sum, day) => sum + day.aicNetAmount, 0)
  const costOptimizationOpportunity = calculateCostOptimizationOpportunity({
    aicNetAmount: overviewAicNetAmount,
    users: userUsage?.users ?? [],
  })

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

                <button
                  type="button"
                  className={`sidebar__item ${activeView === 'products' ? 'sidebar__item--active' : ''}`}
                  onClick={() => setActiveView('products')}
                >
                  <svg className="sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                  </svg>
                  <span className="sidebar__label">Products</span>
                </button>

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

                <hr className="sidebar__divider" />

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
              <OverviewView
                error={error}
                fileName={fileName}
                dailyUsageData={dailyUsageData}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
              />
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
                  costOptimizationOpportunity={costOptimizationOpportunity}
                  onSelectUser={(username) => {
                    setSelectedUsername(username)
                    setActiveView('userDetails')
                  }}
                />
              </div>
              ) : activeView === 'userDetails' ? (
                <div className="view-content">
                  <UserDetailsView
                    user={selectedUser}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onBackToUsers={() => setActiveView('users')}
                  />
                </div>
              ) : activeView === 'costCenters' ? (
              <div className="view-content">
                <CostCentersView data={costCenters ?? { costCenters: [] }} rangeStart={rangeStart} />
              </div>
            ) : activeView === 'products' ? (
              <div className="view-content">
                <ProductsView data={productUsage ?? { products: [] }} />
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
                <OrganizationsView data={orgs ?? { organizations: [] }} rangeStart={rangeStart} />
              </div>
            )}
          </main>
          </div>
        </>
      ) : (
        <UploadPage
          dragActive={dragActive}
          isProcessing={status === 'processing'}
          progress={progress}
          rowsProcessed={rowsProcessed}
          error={error}
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
