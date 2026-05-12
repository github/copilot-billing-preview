import { useMemo } from 'react'
import { DualAxisLineChart } from '../components'
import { BillingTotalsCards } from '../components/ui'
import { PRODUCT_BUDGET_COPILOT, PRODUCT_BUDGET_COPILOT_CLOUD_AGENT, PRODUCT_BUDGET_SPARK } from '../pipeline/productClassification'
import type { BudgetSimulationResult } from '../utils/budgetSimulation'
import type { DailyUsageData } from '../pipeline/aggregators/dailyUsageAggregator'
import { formatAic, formatUsd } from '../utils/format'
import type { IndividualPlanUpgradeRecommendation } from '../utils/individualPlanUpgrade'

export type BudgetField = 'user' | 'account' | 'productCloudAgent' | 'productSpark' | 'productCopilot'

export type BudgetValues = Record<BudgetField, string>

type CostManagementViewProps = {
  budgetValues: BudgetValues
  isIndividualReport: boolean
  currentPruBill: number
  currentPruGrossAmount: number
  currentPruDiscountAmount: number
  currentPruQuantity: number
  currentAicBill: number
  currentAicGrossAmount: number
  currentAicDiscountAmount: number
  currentAicQuantity: number
  licenseAmount?: number
  licenseSeatCounts?: {
    business: number
    enterprise: number
  }
  upgradeRecommendation?: IndividualPlanUpgradeRecommendation | null
  dailyUsageData: DailyUsageData[]
  budgetSimulation: BudgetSimulationResult | null
  budgetSimulationError: string | null
  isApplyingBudgetSimulation: boolean
  onBudgetValueChange: (field: BudgetField, value: string) => void
  onApplyBudgetSimulation: () => void
}

const ACCOUNT_BUDGET_FIELDS: Array<{ field: BudgetField; label: string; description: string }> = [
  {
    field: 'user',
    label: 'User level budget',
    description: 'Applies to pooled AI Credits and additional spend. Controls how many AI Credits a user can spend in total.',
  },
  {
    field: 'account',
    label: 'Account level budget',
    description: 'Controls additional spend only for the current billing period.\nDoes not impact included credits.',
  },
]

const INDIVIDUAL_BUDGET_FIELDS: Array<{ field: BudgetField; label: string; description: string }> = [
  {
    field: 'account',
    label: 'Additional usage budget',
    description: 'Controls additional usage spend only for the current billing period.\nDoes not impact included credits.',
  },
]

const PRODUCT_BUDGET_FIELDS: Array<{ field: BudgetField; label: string; description: string }> = [
  {
    field: 'productCloudAgent',
    label: PRODUCT_BUDGET_COPILOT_CLOUD_AGENT,
    description: 'Applies only to AI Credits additional spend for Copilot Cloud Agent usage.',
  },
  {
    field: 'productSpark',
    label: PRODUCT_BUDGET_SPARK,
    description: 'Applies only to AI Credits additional spend for Spark usage.',
  },
  {
    field: 'productCopilot',
    label: PRODUCT_BUDGET_COPILOT,
    description: 'Applies only to AI Credits additional spend for Copilot usage.',
  },
]

function sanitizeUsdInput(value: string): string {
  const normalized = value.replace(/[^0-9.]/g, '')
  const [wholePart = '', ...rest] = normalized.split('.')
  const decimalPart = rest.join('').slice(0, 2)

  if (normalized.startsWith('.')) {
    return decimalPart ? `0.${decimalPart}` : '0.'
  }

  if (rest.length === 0) {
    return wholePart
  }

  return `${wholePart}.${decimalPart}`
}

function formatSimulationDate(value: string | null): string {
  if (!value) {
    return 'Not reached in this simulation.'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const PRODUCT_SIMULATION_DETAILS = [
  { label: PRODUCT_BUDGET_COPILOT_CLOUD_AGENT, key: PRODUCT_BUDGET_COPILOT_CLOUD_AGENT },
  { label: PRODUCT_BUDGET_SPARK, key: PRODUCT_BUDGET_SPARK },
  { label: PRODUCT_BUDGET_COPILOT, key: PRODUCT_BUDGET_COPILOT },
] as const

export function CostManagementView({
  budgetValues,
  isIndividualReport,
  currentPruBill,
  currentPruGrossAmount,
  currentPruDiscountAmount,
  currentPruQuantity,
  currentAicBill,
  currentAicGrossAmount,
  currentAicDiscountAmount,
  currentAicQuantity,
  licenseAmount,
  licenseSeatCounts,
  upgradeRecommendation = null,
  dailyUsageData,
  budgetSimulation,
  budgetSimulationError,
  isApplyingBudgetSimulation,
  onBudgetValueChange,
  onApplyBudgetSimulation,
}: CostManagementViewProps) {
  const visibleAccountBudgetFields = isIndividualReport ? INDIVIDUAL_BUDGET_FIELDS : ACCOUNT_BUDGET_FIELDS
  const hasVisibleBudgetValue = visibleAccountBudgetFields.some(({ field }) => budgetValues[field].trim() !== '')
    || (!isIndividualReport && PRODUCT_BUDGET_FIELDS.some(({ field }) => budgetValues[field].trim() !== ''))

  const cumulativeSimulationSeries = useMemo(() => {
    if (!budgetSimulation) {
      return null
    }

    const currentByDate = new Map(dailyUsageData.map((day) => [day.date, day.aicNetAmount]))
    const adjustedByDate = new Map(budgetSimulation.adjustedDailyNetCostByDate.map((day) => [day.date, day.amount]))
    const labels = Array.from(new Set([...currentByDate.keys(), ...adjustedByDate.keys()])).sort()

    let currentRunningTotal = 0
    let adjustedRunningTotal = 0

    return {
      labels,
      current: labels.map((date) => {
        currentRunningTotal += currentByDate.get(date) ?? 0
        return currentRunningTotal
      }),
      adjusted: labels.map((date) => {
        adjustedRunningTotal += adjustedByDate.get(date) ?? 0
        return adjustedRunningTotal
      }),
    }
  }, [budgetSimulation, dailyUsageData])

  return (
    <section className="flex flex-col gap-6" aria-label="Cost management">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg text-fg-default">Cost management</h2>
        <p className="m-0 text-[13px] text-fg-muted">Manage editable USD budgets and see the effect they would have on current uploaded report totals.</p>
      </div>

      <BillingTotalsCards
        pruNetAmount={currentPruBill}
        pruGrossAmount={currentPruGrossAmount}
        pruDiscountAmount={currentPruDiscountAmount}
        pruQuantity={currentPruQuantity}
        aicNetAmount={currentAicBill}
        aicGrossAmount={currentAicGrossAmount}
        aicDiscountAmount={currentAicDiscountAmount}
        aicQuantity={currentAicQuantity}
        licenseAmount={licenseAmount}
        licenseSeatCounts={licenseSeatCounts}
        showNegotiatedDiscountDisclaimer={!isIndividualReport}
        showPromotionalDataDisclaimer={isIndividualReport}
        upgradeRecommendation={upgradeRecommendation}
      />

      <div className={`grid grid-cols-1 ${isIndividualReport ? '' : 'xl:grid-cols-2'} gap-4`}>
        {visibleAccountBudgetFields.map(({ field, label, description }) => (
          <label key={field} className="bg-bg-default border border-border-default rounded-md px-5 py-5 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-fg-default">{label}</span>
              <span className="text-[13px] text-fg-muted leading-normal whitespace-pre-line">{description}</span>
            </div>

            <div className="flex items-center rounded-md border border-border-default bg-bg-default focus-within:border-fg-accent focus-within:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]">
              <span className="pl-3 text-sm font-medium text-fg-muted" aria-hidden>
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-fg-default outline-none"
                value={budgetValues[field]}
                onChange={(event) => onBudgetValueChange(field, sanitizeUsdInput(event.target.value))}
                placeholder="0.00"
                aria-label={label}
              />
            </div>
          </label>
        ))}
      </div>

      {!isIndividualReport && (
        <div className="bg-bg-default border border-border-default rounded-md px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <strong className="text-sm font-semibold text-fg-default">Product-level budgets</strong>
            <p className="m-0 text-[13px] text-fg-muted">
              These budgets apply only to <strong className="text-fg-default">AIC additional spend</strong>. Included credits can still be used before additional spend blocking starts.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {PRODUCT_BUDGET_FIELDS.map(({ field, label, description }) => (
              <label key={field} className="border border-border-default rounded-md px-5 py-5 flex flex-col gap-3 bg-bg-muted/30">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-fg-default">{label}</span>
                  <span className="text-[13px] text-fg-muted leading-normal">{description}</span>
                </div>

                <div className="flex items-center rounded-md border border-border-default bg-bg-default focus-within:border-fg-accent focus-within:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]">
                  <span className="pl-3 text-sm font-medium text-fg-muted" aria-hidden>
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-fg-default outline-none"
                    value={budgetValues[field]}
                    onChange={(event) => onBudgetValueChange(field, sanitizeUsdInput(event.target.value))}
                    placeholder="0.00"
                    aria-label={label}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-[13px] text-fg-muted">
            {isIndividualReport
              ? <>The simulation applies the <strong className="text-fg-default">additional usage budget</strong> against total paid AIC additional spend after included credits are used.</>
              : <>The simulation applies the <strong className="text-fg-default">User level budget</strong> per user against cumulative AIC gross cost, the <strong className="text-fg-default">Account level budget</strong> against total paid AIC additional spend, and <strong className="text-fg-default">Product-level budgets</strong> against additional spend for each product bucket. Whichever limit is hit first blocks later requests for that scope.</>}
          </p>
          <button
            type="button"
            className="px-4 py-2 text-[13px] font-medium border border-transparent rounded-md bg-bg-success-emphasis text-fg-on-emphasis cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-default self-start sm:self-auto"
            onClick={onApplyBudgetSimulation}
            disabled={
              isApplyingBudgetSimulation
              || !hasVisibleBudgetValue
            }
          >
            {isApplyingBudgetSimulation ? 'Applying…' : 'Apply'}
          </button>
        </div>

        {budgetSimulationError && (
          <div className="py-3 px-4 rounded-md bg-bg-danger-muted text-fg-danger border border-border-danger text-sm" role="status">
            <span>⚠️ {budgetSimulationError}</span>
          </div>
        )}

        {budgetSimulation && (
          <div className="bg-bg-default border border-border-default rounded-md px-5 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <strong className="text-sm font-semibold text-fg-default">Budget simulation</strong>
              <p className="m-0 text-[13px] text-fg-muted">
                Simulated AIC additional usage bill: <strong className="text-fg-default">{formatUsd(budgetSimulation.totalBill)}</strong>
                {budgetSimulation.budgetExhausted
                  ? isIndividualReport
                    ? ' after the additional usage budget was exhausted.'
                    : ' after the account additional spend budget was exhausted.'
                  : isIndividualReport
                    ? ' after applying the configured additional usage budget.'
                    : ' after applying the configured user, account, and product budget limits.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SimulationSummaryCard
                label="Simulated additional usage bill"
                value={formatUsd(budgetSimulation.totalBill)}
              />
              {!isIndividualReport && (
                <SimulationSummaryCard
                  label="Blocked users"
                  value={budgetSimulation.blockedUsers.toLocaleString()}
                />
              )}
              <SimulationSummaryCard
                label="Blocked PRUs"
                value={budgetSimulation.blockedRequests.toLocaleString()}
              />
              {!isIndividualReport && (
                <SimulationSummaryCard
                  label="Included credits blocked by user budgets"
                  value={formatAic(budgetSimulation.blockedIncludedCreditsAic)}
                />
              )}
            </div>

            <div className="flex flex-col gap-1 text-[13px] text-fg-muted leading-normal">
              {!isIndividualReport && (
                <p className="m-0">
                  First user-level budget block: <strong className="text-fg-default">{formatSimulationDate(budgetSimulation.firstUserBlockedDate)}</strong>
                </p>
              )}
              <p className="m-0">
                {isIndividualReport ? 'Additional usage budget' : 'Account-level budget'} blocked all remaining usage: <strong className="text-fg-default">{formatSimulationDate(budgetSimulation.accountBlockedDate)}</strong>
              </p>
              {!isIndividualReport && PRODUCT_SIMULATION_DETAILS.map((product) => (
                <p key={product.key} className="m-0">
                  {product.label} budget block: <strong className="text-fg-default">{formatSimulationDate(budgetSimulation.productBlockedDates[product.key] ?? null)}</strong>
                </p>
              ))}
            </div>

            {cumulativeSimulationSeries && cumulativeSimulationSeries.labels.length > 0 && (
              <DualAxisLineChart
                title="Cumulative AIC additional usage bill: current vs simulated"
                labels={cumulativeSimulationSeries.labels}
                series={[
                  {
                    label: 'Current additional usage bill',
                    color: '#cf222e',
                    data: cumulativeSimulationSeries.current,
                    yAxisID: 'y',
                  },
                  {
                    label: 'Simulated additional usage bill',
                    color: '#54aeff',
                    data: cumulativeSimulationSeries.adjusted,
                    yAxisID: 'y',
                  },
                ]}
                formatYAsCurrency
                height={320}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

type SimulationSummaryCardProps = {
  label: string
  value: string
}

function SimulationSummaryCard({ label, value }: SimulationSummaryCardProps) {
  return (
    <div className="bg-bg-muted border border-border-default rounded-md px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-fg-default tabular-nums">{value}</span>
    </div>
  )
}
