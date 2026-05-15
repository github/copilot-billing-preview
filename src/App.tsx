import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { MarkGithubIcon, GraphIcon, PeopleIcon, CopilotIcon, TableIcon, OrganizationIcon, DatabaseIcon, InfoIcon, QuestionIcon, CreditCardIcon } from '@primer/octicons-react'

import { NewVersionBanner, UploadPage } from './components'
import { UsersView } from './views/UsersView'
import type { SeatOverrides } from './views/UsersView'
import { UserDetailsView } from './views/UserDetailsView'
import { CostCentersView } from './views/CostCentersView'
import { OrganizationsView } from './views/OrganizationsView'
import { ModelsView } from './views/ModelsView'
import { ReportGuideView } from './views/ReportGuideView'
import { FaqView } from './views/FaqView'
import { ProductsView } from './views/ProductsView'
import { OverviewView } from './views/OverviewView'
import { CostManagementView } from './views/CostManagementView'
import { SpendInsightsView } from './views/SpendInsightsView'
import { appLinks } from './config/links'
import { QuickStatsAggregator, type QuickStatsResult } from './pipeline/aggregators/quickStatsAggregator'
import { ReportContextAggregator, type ReportContextResult } from './pipeline/aggregators/reportContextAggregator'
import { DailyUsageAggregator, type DailyUsageData } from './pipeline/aggregators/dailyUsageAggregator'
import { ModelUsageAggregator, type ModelUsageResult } from './pipeline/aggregators/modelUsageAggregator'
import { ProductUsageAggregator, type ProductUsageResult } from './pipeline/aggregators/productUsageAggregator'
import { CostCenterAggregator, type CostCenterResult } from './pipeline/aggregators/costCenterAggregator'
import { OrganizationAggregator, type OrganizationResult } from './pipeline/aggregators/organizationAggregator'
import { UserUsageAggregator, type UserUsageResult } from './pipeline/aggregators/userUsageAggregator'
import { calculateLicenseSummary, inferReportPlanScope, type AicIncludedCreditsOverrides } from './pipeline/aicIncludedCredits'
import { PRODUCT_BUDGET_COPILOT, PRODUCT_BUDGET_COPILOT_CLOUD_AGENT, PRODUCT_BUDGET_SPARK } from './pipeline/productClassification'
import { runPipeline } from './pipeline/runPipeline'
import { runBudgetSimulation, type BudgetSimulationResult } from './utils/budgetSimulation'
import { EMPTY_BUDGET_VALUES, getDefaultBudgetValues, getUserSpendSegmentsByUsername, type BudgetField, type BudgetValues } from './utils/costManagementBudgets'
import { calculateIndividualPlanUpgradeRecommendation, getIndividualLicenseMonthlyCost } from './utils/individualPlanUpgrade'
import { useAppVersionCheck } from './hooks/useAppVersionCheck'

type Status = 'idle' | 'processing' | 'done'
type ActiveView = 'overview' | 'users' | 'userDetails' | 'costCenters' | 'orgs' | 'models' | 'products' | 'spendInsights' | 'costManagement' | 'guide' | 'faq'

const BUSINESS_LICENSE_MONTHLY_COST = 19
const ENTERPRISE_LICENSE_MONTHLY_COST = 39

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [quickStats, setQuickStats] = useState<QuickStatsResult | null>(null)
  const [reportContext, setReportContext] = useState<ReportContextResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dailyUsageData, setDailyUsageData] = useState<DailyUsageData[]>([])
  const [activeView, setActiveView] = useState<ActiveView>('overview')
  const [userUsage, setUserUsage] = useState<UserUsageResult | null>(null)
  const [modelUsage, setModelUsage] = useState<ModelUsageResult | null>(null)
  const [productUsage, setProductUsage] = useState<ProductUsageResult | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string>('')
  const [costCenters, setCostCenters] = useState<CostCenterResult | null>(null)
  const [orgs, setOrgs] = useState<OrganizationResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [rowsProcessed, setRowsProcessed] = useState(0)
  const [seatOverrides, setSeatOverrides] = useState<SeatOverrides>({})
  const [budgetValues, setBudgetValues] = useState<BudgetValues>(EMPTY_BUDGET_VALUES)
  const [budgetSimulation, setBudgetSimulation] = useState<BudgetSimulationResult | null>(null)
  const [budgetSimulationError, setBudgetSimulationError] = useState<string | null>(null)
  const [isApplyingBudgetSimulation, setIsApplyingBudgetSimulation] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentFileRef = useRef<File | null>(null)
  const latestRunIdRef = useRef(0)
  const latestSimulationIdRef = useRef(0)
  const { isUpdateAvailable, reloadApp } = useAppVersionCheck()

  const applyProcessedData = useCallback(({
    quickStats,
    reportContext,
    dailyUsageData,
    modelUsage,
    productUsage,
    costCenters,
    orgs,
    userUsage,
  }: {
    quickStats: QuickStatsResult
    reportContext: ReportContextResult
    dailyUsageData: DailyUsageData[]
    modelUsage: ModelUsageResult
    productUsage: ProductUsageResult
    costCenters: CostCenterResult
    orgs: OrganizationResult
    userUsage: UserUsageResult
  }) => {
    setQuickStats(quickStats)
    setReportContext(reportContext)
    setDailyUsageData(dailyUsageData)
    setModelUsage(modelUsage)
    setProductUsage(productUsage)
    setCostCenters(costCenters)
    setOrgs(orgs)
    setUserUsage(userUsage)
  }, [])

  const buildReportData = useCallback(async (
    file: File,
    includedCreditsOverrides: AicIncludedCreditsOverrides = {},
    onProgress?: (progressInfo: { rowsProcessed: number; progressPercent: number }) => void,
  ) => {
    const statsAggregator = new QuickStatsAggregator()
    const contextAggregator = new ReportContextAggregator()
    const dailyAggregator = new DailyUsageAggregator()
    const modelAggregator = new ModelUsageAggregator()
    const productAggregator = new ProductUsageAggregator()
    const costCenterAggregator = new CostCenterAggregator()
    const orgAggregator = new OrganizationAggregator()
    const userAggregator = new UserUsageAggregator()

    const pipelineResult = await runPipeline(file, [
      statsAggregator,
      contextAggregator,
      dailyAggregator,
      modelAggregator,
      productAggregator,
      costCenterAggregator,
      orgAggregator,
      userAggregator,
    ], {
      includedCreditsOverrides,
      progressResolution: 500,
      onProgress,
    })

    return {
      quickStats: {
        ...statsAggregator.result(),
        lineCount: pipelineResult.reportRowCount,
      },
      reportContext: contextAggregator.result(),
      dailyUsageData: dailyAggregator.result().dailyData,
      modelUsage: modelAggregator.result(),
      productUsage: productAggregator.result(),
      costCenters: costCenterAggregator.result(),
      orgs: orgAggregator.result(),
      userUsage: userAggregator.result(),
    }
  }, [])

  const normalizeSeatOverride = useCallback((value: number, minimum: number): number => {
    if (!Number.isFinite(value)) {
      return minimum
    }

    return Math.max(minimum, Math.floor(value))
  }, [])

  const getDefaultSeatCounts = useCallback(() => {
    const summary = calculateLicenseSummary(userUsage?.users ?? [])
    return {
      business: normalizeSeatOverride(
        summary.rows.find((row) => row.label === 'Copilot Business')?.users ?? 0,
        0,
      ),
      enterprise: normalizeSeatOverride(
        summary.rows.find((row) => row.label === 'Copilot Enterprise')?.users ?? 0,
        0,
      ),
    }
  }, [normalizeSeatOverride, userUsage])

  const resetReportState = useCallback(({ status, fileName }: { status: Status; fileName: string | null }) => {
    setStatus(status)
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
    setFileName(fileName)
    setDragActive(false)
    setProgress(0)
    setRowsProcessed(0)
    setSeatOverrides({})
    setBudgetValues(EMPTY_BUDGET_VALUES)
    setBudgetSimulation(null)
    setBudgetSimulationError(null)
    setIsApplyingBudgetSimulation(false)
  }, [])

  const handleProcess = useCallback(async (file: File) => {
    currentFileRef.current = file
    const runId = ++latestRunIdRef.current
    latestSimulationIdRef.current += 1
    resetReportState({ status: 'processing', fileName: file.name })

    try {
      const nextData = await buildReportData(file, {}, (progressInfo) => {
        if (runId !== latestRunIdRef.current) return
        setRowsProcessed(progressInfo.rowsProcessed)
        setProgress(progressInfo.progressPercent)
      })

      if (runId !== latestRunIdRef.current) return

      setProgress(100)
      applyProcessedData(nextData)
      setBudgetValues(getDefaultBudgetValues(nextData.userUsage.users))
      setStatus('done')
    } catch (err) {
      if (runId !== latestRunIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to process the report.')
      setStatus('idle')
      setProgress(0)
      setRowsProcessed(0)
    }
  }, [applyProcessedData, buildReportData, resetReportState])

  const resolveIncludedCreditOverrides = useCallback((overrides: SeatOverrides): AicIncludedCreditsOverrides => {
    if (overrides.business === undefined && overrides.enterprise === undefined) {
      return {}
    }

    const { business: defaultBusiness, enterprise: defaultEnterprise } = getDefaultSeatCounts()

    return {
      business: overrides.business === undefined
        ? defaultBusiness
        : normalizeSeatOverride(overrides.business, defaultBusiness),
      enterprise: overrides.enterprise === undefined
        ? defaultEnterprise
        : normalizeSeatOverride(overrides.enterprise, defaultEnterprise),
    }
  }, [getDefaultSeatCounts, normalizeSeatOverride])

  const compactSeatOverrides = useCallback((overrides: AicIncludedCreditsOverrides): SeatOverrides => {
    if (overrides.business === undefined && overrides.enterprise === undefined) {
      return {}
    }

    const { business: defaultBusiness, enterprise: defaultEnterprise } = getDefaultSeatCounts()
    const compactOverrides: SeatOverrides = {}

    if ((overrides.business ?? defaultBusiness) > defaultBusiness) {
      compactOverrides.business = overrides.business
    }

    if ((overrides.enterprise ?? defaultEnterprise) > defaultEnterprise) {
      compactOverrides.enterprise = overrides.enterprise
    }

    return compactOverrides
  }, [getDefaultSeatCounts])

  const handleBudgetValueChange = useCallback((field: BudgetField, value: string) => {
    latestSimulationIdRef.current += 1
    setBudgetValues((current) => ({
      ...current,
      [field]: value,
    }))
    setBudgetSimulation(null)
    setBudgetSimulationError(null)
    setIsApplyingBudgetSimulation(false)
  }, [])

  const handleSeatOverridesChange = useCallback(async (overrides: SeatOverrides) => {
    const file = currentFileRef.current
    if (!file) return

    const runId = ++latestRunIdRef.current
    latestSimulationIdRef.current += 1
    const resolvedOverrides = resolveIncludedCreditOverrides(overrides)
    setError(null)
    setBudgetSimulation(null)
    setBudgetSimulationError(null)
    setIsApplyingBudgetSimulation(false)

    try {
      const nextData = await buildReportData(file, resolvedOverrides)
      if (runId !== latestRunIdRef.current) return

      applyProcessedData(nextData)
      setSeatOverrides(compactSeatOverrides(resolvedOverrides))
    } catch (err) {
      if (runId !== latestRunIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to recalculate usage-based billing.')
    }
  }, [applyProcessedData, buildReportData, compactSeatOverrides, resolveIncludedCreditOverrides])

  const handleApplyBudgetSimulation = useCallback(async () => {
    const file = currentFileRef.current
    if (!file) return

    const budgetReportUsers = userUsage?.users ?? []
    const hasBudgetOrganizationContext = budgetReportUsers.some((user) => user.organizations.length > 0 || user.costCenters.length > 0)
    const isIndividualBudgetReport = inferReportPlanScope(budgetReportUsers.length, hasBudgetOrganizationContext) === 'individual'
    const parsedAccountBudget = budgetValues.account.trim() === '' ? undefined : Number(budgetValues.account)
    const parsedUserBudget = !isIndividualBudgetReport && budgetValues.user.trim() !== '' ? Number(budgetValues.user) : undefined
    const parsedPowerUserBudget = !isIndividualBudgetReport && budgetValues.powerUser.trim() !== '' ? Number(budgetValues.powerUser) : undefined
    const parsedHeavyUserBudget = !isIndividualBudgetReport && budgetValues.heavyUser.trim() !== '' ? Number(budgetValues.heavyUser) : undefined
    const parsedProductCloudAgentBudget = !isIndividualBudgetReport && budgetValues.productCloudAgent.trim() !== '' ? Number(budgetValues.productCloudAgent) : undefined
    const parsedProductSparkBudget = !isIndividualBudgetReport && budgetValues.productSpark.trim() !== '' ? Number(budgetValues.productSpark) : undefined
    const parsedProductCopilotBudget = !isIndividualBudgetReport && budgetValues.productCopilot.trim() !== '' ? Number(budgetValues.productCopilot) : undefined

    if (
      parsedAccountBudget === undefined
      && parsedUserBudget === undefined
      && parsedPowerUserBudget === undefined
      && parsedHeavyUserBudget === undefined
      && parsedProductCloudAgentBudget === undefined
      && parsedProductSparkBudget === undefined
      && parsedProductCopilotBudget === undefined
    ) {
      setBudgetSimulation(null)
      setBudgetSimulationError(isIndividualBudgetReport
        ? 'Enter an additional usage budget in USD before running the simulation.'
        : 'Enter a user-level, account-level, or product-level budget in USD before running the simulation.')
      return
    }

    if (
      (parsedAccountBudget !== undefined && !Number.isFinite(parsedAccountBudget))
      || (parsedUserBudget !== undefined && !Number.isFinite(parsedUserBudget))
      || (parsedPowerUserBudget !== undefined && !Number.isFinite(parsedPowerUserBudget))
      || (parsedHeavyUserBudget !== undefined && !Number.isFinite(parsedHeavyUserBudget))
      || (parsedProductCloudAgentBudget !== undefined && !Number.isFinite(parsedProductCloudAgentBudget))
      || (parsedProductSparkBudget !== undefined && !Number.isFinite(parsedProductSparkBudget))
      || (parsedProductCopilotBudget !== undefined && !Number.isFinite(parsedProductCopilotBudget))
    ) {
      setBudgetSimulation(null)
      setBudgetSimulationError('Enter valid USD budget values before running the simulation.')
      return
    }

    const simulationId = ++latestSimulationIdRef.current
    setBudgetSimulationError(null)
    setIsApplyingBudgetSimulation(true)

    try {
      const result = await runBudgetSimulation(
        file,
        {
          accountBudgetUsd: parsedAccountBudget,
          userBudgetUsd: parsedUserBudget,
          userBudgetUsdBySpendSegment: {
            power: parsedPowerUserBudget,
            heavy: parsedHeavyUserBudget,
          },
          userSpendSegmentsByUsername: getUserSpendSegmentsByUsername(budgetReportUsers),
          productBudgetsUsd: {
            [PRODUCT_BUDGET_COPILOT_CLOUD_AGENT]: parsedProductCloudAgentBudget,
            [PRODUCT_BUDGET_SPARK]: parsedProductSparkBudget,
            [PRODUCT_BUDGET_COPILOT]: parsedProductCopilotBudget,
          },
        },
        resolveIncludedCreditOverrides(seatOverrides),
      )

      if (simulationId !== latestSimulationIdRef.current) return
      setBudgetSimulation(result)
    } catch (err) {
      if (simulationId !== latestSimulationIdRef.current) return
      setBudgetSimulation(null)
      setBudgetSimulationError(err instanceof Error ? err.message : 'Failed to run the budget simulation.')
    } finally {
      if (simulationId === latestSimulationIdRef.current) {
        setIsApplyingBudgetSimulation(false)
      }
    }
  }, [
    budgetValues.account,
    budgetValues.heavyUser,
    budgetValues.powerUser,
    budgetValues.productCloudAgent,
    budgetValues.productCopilot,
    budgetValues.productSpark,
    budgetValues.user,
    resolveIncludedCreditOverrides,
    seatOverrides,
    userUsage,
  ])

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

  const resetToUploadView = () => {
    latestRunIdRef.current += 1
    latestSimulationIdRef.current += 1
    currentFileRef.current = null
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    resetReportState({ status: 'idle', fileName: null })
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
  const reportUsers = userUsage?.users ?? []
  const hasOrganizationContext = reportUsers.some((user) => user.organizations.length > 0 || user.costCenters.length > 0)
  const reportPlanScope = inferReportPlanScope(reportUsers.length, hasOrganizationContext)
  const isIndividualReport = reportPlanScope === 'individual' && reportUsers.length === 1
  const individualUser = isIndividualReport ? reportUsers[0] : null
  const { business: defaultBusinessSeats, enterprise: defaultEnterpriseSeats } = getDefaultSeatCounts()
  const effectiveBusinessSeats = seatOverrides.business ?? defaultBusinessSeats
  const effectiveEnterpriseSeats = seatOverrides.enterprise ?? defaultEnterpriseSeats
  const organizationLicenseAmount = effectiveBusinessSeats * BUSINESS_LICENSE_MONTHLY_COST + effectiveEnterpriseSeats * ENTERPRISE_LICENSE_MONTHLY_COST
  const licenseAmount = reportPlanScope === 'organization'
    ? organizationLicenseAmount || undefined
    : individualUser
      ? getIndividualLicenseMonthlyCost(individualUser.totalMonthlyQuota)
      : undefined
  const licenseSeatCounts = reportPlanScope === 'organization'
    ? { business: effectiveBusinessSeats, enterprise: effectiveEnterpriseSeats }
    : undefined

  const selectedUser = individualUser
    ?? (selectedUsername && userUsage
      ? userUsage.users.find((user) => user.username === selectedUsername) ?? null
      : null)
  const canShowSpendInsights = Boolean(userUsage) && !isIndividualReport && reportUsers.length > 1
  const visibleActiveView = activeView === 'spendInsights' && !canShowSpendInsights ? 'overview' : activeView
  const userNavActive = isIndividualReport
    ? visibleActiveView === 'userDetails'
    : visibleActiveView === 'users' || visibleActiveView === 'userDetails'
  const openUserView = () => {
    if (isIndividualReport) {
      setActiveView('userDetails')
      return
    }

    setActiveView('users')
  }

  const overviewTotals = dailyUsageData.reduce(
    (totals, day) => {
      totals.requests += day.requests
      totals.grossAmount += day.grossAmount
      totals.discountAmount += day.discountAmount
      totals.netAmount += day.netAmount
      totals.aicQuantity += day.aicQuantity
      totals.aicGrossAmount += day.aicGrossAmount
      totals.aicNetAmount += day.aicNetAmount
      return totals
    },
    { requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0, aicQuantity: 0, aicGrossAmount: 0, aicNetAmount: 0 },
  )
  const overviewPruNetAmount = overviewTotals.netAmount
  const overviewAicNetAmount = overviewTotals.aicNetAmount
  const overviewAicDiscountAmount = Math.max(overviewTotals.aicGrossAmount - overviewAicNetAmount, 0)
  const monthlyAicAdditionalUsageBills = Array.from(dailyUsageData.reduce((monthlyBills, day) => {
    const monthKey = day.date.slice(0, 7)
    monthlyBills.set(monthKey, (monthlyBills.get(monthKey) ?? 0) + day.aicNetAmount)
    return monthlyBills
  }, new Map<string, number>()).values())
  const individualUpgradeRecommendation = individualUser
    ? calculateIndividualPlanUpgradeRecommendation({
        totalMonthlyQuota: individualUser.totalMonthlyQuota,
        currentMonthlyAicAdditionalUsageBillsUsd: monthlyAicAdditionalUsageBills,
      })
    : null

  const sidebarItemBase = 'flex items-center gap-[10px] w-full px-3 py-[10px] border-0 rounded-md bg-transparent text-[13px] font-medium cursor-pointer text-left transition-colors hover:bg-bg-muted hover:text-fg-default disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-[-2px] max-sm:justify-center max-sm:p-2'
  const sidebarActive = 'bg-app-accent-subtle text-app-accent font-semibold hover:bg-app-accent-muted'
  const sidebarInactive = 'text-fg-muted'
  const viewContentClasses = 'max-w-[var(--width-content-max)] w-full mx-auto px-6 pt-8 pb-12 flex flex-col gap-6'

  return (
    <div className={`min-h-screen flex flex-col ${hasReport ? 'bg-bg-muted' : ''}`}>
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
        aria-label="Upload CSV report"
        style={{ display: 'none' }}
      />

      <header className="bg-header-bg py-[14px] px-6 flex justify-between items-center gap-3 flex-wrap max-sm:px-4 max-sm:py-3">
        <div className="flex items-center gap-3">
          <MarkGithubIcon size={32} className="block text-white" aria-hidden />
          <span className="text-lg font-semibold text-white tracking-tight max-sm:text-xs">Billing Preview</span>
        </div>
        {hasReport && (
          <div className="flex items-center max-sm:w-full">
            <button type="button" className="border border-border-emphasis rounded-md bg-transparent text-white px-4 py-2 text-sm font-medium cursor-pointer transition-colors whitespace-nowrap hover:bg-white/[0.08] hover:border-border-emphasis focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 max-sm:w-full max-sm:text-center" onClick={resetToUploadView}>
              Upload new report
            </button>
          </div>
        )}
      </header>

      {hasReport ? (
        <>
          <nav className="bg-bg-default border-b border-border-default px-6 py-3 flex justify-between items-center gap-4 flex-wrap max-sm:px-4 max-sm:flex-col max-sm:items-start max-sm:gap-3">
            <div className="flex items-center gap-2 flex-wrap text-sm text-fg-default max-sm:flex-col max-sm:items-start max-sm:gap-1">
              <span className="text-fg-muted font-medium max-sm:hidden">File:</span>
              <span className="font-semibold text-fg-default max-sm:hidden">{fileName ?? 'Processing…'}</span>
              {reportContext && (reportContext.startDate || reportContext.endDate) && (
                <>
                  <span className="text-border-default mx-1 max-sm:hidden">|</span>
                  <span className="text-fg-muted font-medium">Report window:</span>
                  <span className="font-semibold text-fg-default">
                    {reportContext.startDate ?? '—'} to {reportContext.endDate ?? '—'}
                  </span>
                </>
              )}
              {quickStats && (
                <>
                  <span className="text-border-default mx-1 max-sm:hidden">|</span>
                  <span className="text-fg-muted font-medium max-sm:hidden">Total rows:</span>
                  <span className="font-semibold text-fg-default max-sm:hidden">{quickStats.lineCount.toLocaleString()}</span>
                </>
              )}
            </div>
          </nav>

          <div className="flex flex-1 min-h-0">
            <aside className="w-[var(--width-sidebar)] shrink-0 p-4 pr-0 sticky top-0 self-start max-h-screen overflow-y-auto max-sm:w-12 max-sm:pl-1" aria-label="Navigation">
              <nav className="bg-bg-default border border-border-default rounded-lg p-[6px] flex flex-col gap-[2px] max-sm:border-0 max-sm:p-[2px]">
                <button
                  type="button"
                  className={`${sidebarItemBase} ${visibleActiveView === 'overview' ? sidebarActive : sidebarInactive}`}
                  onClick={() => setActiveView('overview')}
                >
                  <GraphIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Overview</span>
                </button>

                <button
                  type="button"
                  className={`${sidebarItemBase} ${userNavActive ? sidebarActive : sidebarInactive}`}
                  disabled={!userUsage}
                  onClick={openUserView}
                >
                  <PeopleIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">{isIndividualReport ? 'User' : 'Users'}</span>
                </button>

                {modelUsage && modelUsage.models.length > 0 && (
                  <button
                    type="button"
                    className={`${sidebarItemBase} ${visibleActiveView === 'models' ? sidebarActive : sidebarInactive}`}
                    onClick={() => setActiveView('models')}
                  >
                    <CopilotIcon size={18} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Models</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`${sidebarItemBase} ${visibleActiveView === 'products' ? sidebarActive : sidebarInactive}`}
                  onClick={() => setActiveView('products')}
                >
                  <TableIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Products</span>
                </button>

                {orgs && orgs.organizations.length > 0 && (
                  <button
                    type="button"
                    className={`${sidebarItemBase} ${visibleActiveView === 'orgs' ? sidebarActive : sidebarInactive}`}
                    onClick={() => setActiveView('orgs')}
                  >
                    <OrganizationIcon size={18} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Organizations</span>
                  </button>
                )}

                {costCenters && costCenters.costCenters.length > 0 && (
                  <button
                    type="button"
                    className={`${sidebarItemBase} ${visibleActiveView === 'costCenters' ? sidebarActive : sidebarInactive}`}
                    onClick={() => setActiveView('costCenters')}
                  >
                    <DatabaseIcon size={18} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Cost Centers</span>
                  </button>
                )}

                {canShowSpendInsights && (
                  <button
                    type="button"
                    className={`${sidebarItemBase} ${visibleActiveView === 'spendInsights' ? sidebarActive : sidebarInactive}`}
                    onClick={() => setActiveView('spendInsights')}
                  >
                    <GraphIcon size={18} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Spend Insights</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`${sidebarItemBase} ${visibleActiveView === 'costManagement' ? sidebarActive : sidebarInactive}`}
                  onClick={() => setActiveView('costManagement')}
                >
                  <CreditCardIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Cost Management</span>
                </button>

                <hr className="border-0 border-t border-border-default my-[6px]" />

                <button
                  type="button"
                  className={`${sidebarItemBase} ${visibleActiveView === 'guide' ? sidebarActive : sidebarInactive}`}
                  onClick={() => setActiveView('guide')}
                >
                  <InfoIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">Report Format</span>
                </button>

                <button
                  type="button"
                  className={`${sidebarItemBase} ${visibleActiveView === 'faq' ? sidebarActive : sidebarInactive}`}
                  onClick={() => setActiveView('faq')}
                >
                  <QuestionIcon size={18} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-sm:sr-only">FAQ</span>
                </button>
              </nav>
            </aside>

            <main className="flex-1 min-w-0 flex flex-col">
            {visibleActiveView === 'overview' ? (
              <OverviewView
                error={error}
                fileName={fileName}
                dailyUsageData={dailyUsageData}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                licenseAmount={licenseAmount}
                licenseSeatCounts={licenseSeatCounts}
                reportPlanScope={reportPlanScope}
                upgradeRecommendation={individualUpgradeRecommendation}
              />
            ) : visibleActiveView === 'models' ? (
              modelUsage && modelUsage.models.length > 0 ? (
                <div className={viewContentClasses}>
                  <ModelsView
                    modelUsage={modelUsage}
                    isIndividualReport={isIndividualReport}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                  />
                </div>
              ) : null
            ) : visibleActiveView === 'users' && !isIndividualReport ? (
                <div className={viewContentClasses}>
                  <UsersView
                    users={reportUsers}
                    seatOverrides={seatOverrides}
                    onSeatOverridesChange={(overrides) => {
                      void handleSeatOverridesChange(overrides)
                    }}
                    onSelectUser={(username) => {
                      setSelectedUsername(username)
                      setActiveView('userDetails')
                   }}
                 />
               </div>
                ) : visibleActiveView === 'userDetails' || (visibleActiveView === 'users' && isIndividualReport) ? (
                 <div className={viewContentClasses}>
                    <UserDetailsView
                       user={selectedUser}
                       reportPlanScope={reportPlanScope}
                       showUsersBreadcrumb={!isIndividualReport}
                       rangeStart={rangeStart}
                       rangeEnd={rangeEnd}
                     onBackToUsers={isIndividualReport ? undefined : () => setActiveView('users')}
                   />
                 </div>
               ) : visibleActiveView === 'costCenters' ? (
              <div className={viewContentClasses}>
                <CostCentersView data={costCenters ?? { costCenters: [] }} rangeStart={rangeStart} />
              </div>
               ) : visibleActiveView === 'products' ? (
                <div className={viewContentClasses}>
                  <ProductsView data={productUsage ?? { products: [] }} />
                </div>
               ) : visibleActiveView === 'spendInsights' ? (
                <div className={viewContentClasses}>
                  <SpendInsightsView
                    users={reportUsers}
                    onSelectUser={(username) => {
                      setSelectedUsername(username)
                      setActiveView('userDetails')
                    }}
                  />
                </div>
               ) : visibleActiveView === 'costManagement' ? (
                <div className={viewContentClasses}>
                   <CostManagementView
                    budgetValues={budgetValues}
                    isIndividualReport={isIndividualReport}
                    currentPruBill={overviewPruNetAmount}
                    currentPruGrossAmount={overviewTotals.grossAmount}
                    currentPruDiscountAmount={overviewTotals.discountAmount}
                    currentPruQuantity={overviewTotals.requests}
                    currentAicBill={overviewAicNetAmount}
                    currentAicGrossAmount={overviewTotals.aicGrossAmount}
                    currentAicDiscountAmount={overviewAicDiscountAmount}
                    currentAicQuantity={overviewTotals.aicQuantity}
                    licenseAmount={licenseAmount}
                    licenseSeatCounts={licenseSeatCounts}
                    upgradeRecommendation={individualUpgradeRecommendation}
                    dailyUsageData={dailyUsageData}
                    budgetSimulation={budgetSimulation}
                    budgetSimulationError={budgetSimulationError}
                    isApplyingBudgetSimulation={isApplyingBudgetSimulation}
                    onBudgetValueChange={handleBudgetValueChange}
                    onApplyBudgetSimulation={handleApplyBudgetSimulation}
                  />
                </div>
             ) : visibleActiveView === 'guide' ? (
               <div className={viewContentClasses}>
                 <ReportGuideView />
              </div>
            ) : visibleActiveView === 'faq' ? (
              <div className={viewContentClasses}>
                <FaqView />
              </div>
            ) : (
              <div className={viewContentClasses}>
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
        <footer className="text-center text-fg-muted text-xs leading-[1.6] pt-6 px-4 pb-10 max-w-[960px] mx-auto w-full [&_a]:text-fg-muted [&_a]:no-underline [&_a:hover]:underline">
          This is a preview based on your uploaded usage data. Actual bills may differ.<br />
          Your data never leaves your browser.{' '}
          Something is not right? <a href={appLinks.issues} target="_blank" rel="noopener noreferrer">Submit an issue</a>.
        </footer>
      )}

      <NewVersionBanner isVisible={isUpdateAvailable} onReload={reloadApp} />
    </div>
  )
}

export default App
