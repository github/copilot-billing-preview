import { useMemo } from 'react'
import { DualAxisLineChart } from '../components'
import { BillingTotalsCards } from '../components/ui'
import { PRODUCT_BUDGET_COPILOT, PRODUCT_BUDGET_COPILOT_CLOUD_AGENT, PRODUCT_BUDGET_SPARK } from '../pipeline/productClassification'
import type { BudgetSimulationResult } from '../utils/budgetSimulation'
import { AIC_UNIT_PRICE_USD } from '../utils/billingConstants'
import type { BudgetField, BudgetValues } from '../utils/costManagementBudgets'
import type { DailyUsageData } from '../pipeline/aggregators/dailyUsageAggregator'
import { formatAic, formatUsd } from '../utils/format'
import type { IndividualPlanUpgradeRecommendation } from '../utils/individualPlanUpgrade'
import { th, thNum, td, tdNum } from '../components/ui/tableStyles'

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
  includedAicPoolSize: number
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

const ACCOUNT_BUDGET_FIELD: { field: BudgetField; label: string; description: string } = {
  field: 'account',
  label: 'Account-level budget',
  description: 'Controls additional spend only for the current billing period.\nDoes not impact included credits.',
}

const USER_BUDGET_FIELDS: Array<{ field: BudgetField; label: string; description: string }> = [
  {
    field: 'user',
    label: 'Universal user-level budget',
    description: 'Default per-user limit for cumulative AIC gross cost.',
  },
  {
    field: 'heavyUser',
    label: 'Heavy users budget',
    description: 'Applies to users classified as Heavy users in this report.',
  },
  {
    field: 'powerUser',
    label: 'Power users budget',
    description: 'Applies to users classified as Power users in this report.',
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
    description: 'Applies only to additional AIC spend for Copilot Cloud Agent usage.',
  },
  {
    field: 'productSpark',
    label: PRODUCT_BUDGET_SPARK,
    description: 'Applies only to additional AIC spend for Spark usage.',
  },
  {
    field: 'productCopilot',
    label: PRODUCT_BUDGET_COPILOT,
    description: 'Applies only to additional AIC spend for Copilot usage.',
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

const CURRENT_GROSS_COST_COLOR = '#afb8c1'
const SIMULATED_INCLUDED_COLOR = '#1a7f37'
const SIMULATED_ADDITIONAL_COLOR = '#cf222e'
const INCLUDED_CREDITS_POOL_COLOR = '#0969da'

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
  includedAicPoolSize,
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
  const visibleAccountBudgetFields = isIndividualReport ? INDIVIDUAL_BUDGET_FIELDS : [ACCOUNT_BUDGET_FIELD]
  const hasVisibleBudgetValue = visibleAccountBudgetFields.some(({ field }) => budgetValues[field].trim() !== '')
    || (!isIndividualReport && USER_BUDGET_FIELDS.some(({ field }) => budgetValues[field].trim() !== ''))
    || (!isIndividualReport && PRODUCT_BUDGET_FIELDS.some(({ field }) => budgetValues[field].trim() !== ''))

  const cumulativeSimulationSeries = useMemo(() => {
    if (!budgetSimulation) {
      return null
    }

    const currentByDate = new Map(dailyUsageData.map((day) => [day.date, day.aicGrossAmount]))
    const adjustedByDate = new Map(budgetSimulation.adjustedDailyGrossCostByDate.map((day) => [day.date, day.amount]))
    const labels = Array.from(new Set([...currentByDate.keys(), ...adjustedByDate.keys()])).sort()
    const includedPoolGrossCost = includedAicPoolSize * AIC_UNIT_PRICE_USD

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
      includedPoolGrossCost,
    }
  }, [budgetSimulation, dailyUsageData, includedAicPoolSize])

  const budgetSimulationBillingCards = useMemo(() => {
    if (!budgetSimulation) {
      return []
    }

    const simulatedAicGrossAmount = budgetSimulation.adjustedDailyGrossCostByDate.reduce((total, day) => total + day.amount, 0)

    return [
      {
        label: 'Current (no budgets)',
        totalAmount: currentAicBill + (licenseAmount ?? 0),
        aicQuantity: currentAicQuantity,
        grossAmount: currentAicGrossAmount,
        includedAmount: currentAicDiscountAmount,
        additionalUsageAmount: currentAicBill,
      },
      {
        label: 'Simulated (budgets applied)',
        totalAmount: budgetSimulation.totalBill + (licenseAmount ?? 0),
        aicQuantity: budgetSimulation.allowedAicQuantity,
        grossAmount: simulatedAicGrossAmount,
        includedAmount: Math.max(simulatedAicGrossAmount - budgetSimulation.totalBill, 0),
        additionalUsageAmount: budgetSimulation.totalBill,
      },
    ]
  }, [
    budgetSimulation,
    currentAicBill,
    currentAicDiscountAmount,
    currentAicGrossAmount,
    currentAicQuantity,
    licenseAmount,
  ])

  return (
    <section className="flex flex-col gap-6" aria-label="Cost management">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg text-fg-default">Cost management</h2>
        <p className="m-0 text-[13px] text-fg-muted">Set USD budgets and preview how they would affect the uploaded report.</p>
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
        showExistingDiscountDisclaimer={!isIndividualReport}
        showPromotionalDataDisclaimer={isIndividualReport}
        upgradeRecommendation={upgradeRecommendation}
      />

      <div className="grid grid-cols-1 gap-4">
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
            <strong className="text-sm font-semibold text-fg-default">User-level budgets</strong>
            <p className="m-0 text-[13px] text-fg-muted">
              These budgets apply per user to cumulative AIC gross cost. Heavy and Power budgets replace the universal budget for users classified into those groups.
            </p>
            <p className="m-0 text-[13px] text-fg-muted">
              Values are prepopulated from the average AIC gross cost for the spending groups identified in the <strong className="text-fg-default">Spend Insights</strong> section.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {USER_BUDGET_FIELDS.map(({ field, label, description }) => (
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
               : <>The simulation applies <strong className="text-fg-default">User-level budgets</strong> per user to cumulative AIC gross cost, the <strong className="text-fg-default">account-level budget</strong> to total paid AIC additional spend, and <strong className="text-fg-default">product-level budgets</strong> to additional spend for each product bucket. The first limit reached blocks later requests for that scope.</>}
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
          <div className="flex flex-col gap-4">
            <strong className="text-sm font-semibold text-fg-default">Budget simulation results</strong>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {budgetSimulationBillingCards.map((card) => (
                <div key={card.label} className="bg-bg-default border border-border-default rounded-md px-5 py-[28px] text-center">
                  <div className="text-[13px] font-medium text-fg-muted uppercase tracking-[0.5px] mb-3">{card.label}</div>
                  <div className="text-4xl font-bold leading-[1.2] text-app-savings-fg">{formatUsd(card.totalAmount)}</div>
                  <div className="text-sm text-fg-default mt-[6px]">{formatAic(card.aicQuantity)} AICs</div>
                  <div className="text-xs text-fg-muted mt-1">1 AIC = $0.01</div>
                  <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-[6px] text-left">
                    <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                      <span>Consumed AICs</span>
                      <span>{formatUsd(card.grossAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                      <span>Included AICs</span>
                      <span>−{formatUsd(card.includedAmount)}</span>
                    </div>
                    <div className="pt-[6px] border-t border-dotted border-border-muted flex flex-col gap-[6px]">
                      <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                        <span>Additional usage</span>
                        <span>{formatUsd(card.additionalUsageAmount)}</span>
                      </div>
                      {licenseAmount !== undefined && (
                        <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                          <span>License cost</span>
                          <span>{formatUsd(licenseAmount)}</span>
                        </div>
                      )}
                      {licenseAmount !== undefined && (
                        <div className="pt-[6px] border-t border-border-default">
                          <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums font-semibold">
                            <span>Total (license + additional usage)</span>
                            <span>{formatUsd(card.totalAmount)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="m-0 text-center text-[13px] text-fg-muted">
              Simulated AIC additional usage spend: <strong className="text-fg-default">{formatUsd(budgetSimulation.totalBill)}</strong> with the configured budgets applied.
            </p>

            {cumulativeSimulationSeries && cumulativeSimulationSeries.labels.length > 0 && (
              <DualAxisLineChart
                title="Cumulative AIC gross cost: current vs simulated"
                labels={cumulativeSimulationSeries.labels}
                series={[
                  {
                    label: 'Current AIC gross cost',
                    legendOrder: 3,
                    color: CURRENT_GROSS_COST_COLOR,
                    data: cumulativeSimulationSeries.current,
                    yAxisID: 'y',
                    order: 2,
                  },
                  {
                    label: 'Simulated AIC gross cost',
                    legendLabel: 'Simulated - within included pool',
                    legendOrder: 1,
                    color: SIMULATED_INCLUDED_COLOR,
                    data: cumulativeSimulationSeries.adjusted,
                    yAxisID: 'y',
                    order: 1,
                    segmentColor: (_startValue, endValue) => (
                      endValue <= cumulativeSimulationSeries.includedPoolGrossCost
                        ? SIMULATED_INCLUDED_COLOR
                        : SIMULATED_ADDITIONAL_COLOR
                    ),
                  },
                  {
                    label: 'Included AI Credits pool',
                    legendOrder: 4,
                    color: INCLUDED_CREDITS_POOL_COLOR,
                    data: cumulativeSimulationSeries.labels.map(() => cumulativeSimulationSeries.includedPoolGrossCost),
                    yAxisID: 'y',
                    borderDash: [2, 4],
                    order: 3,
                    pointRadius: 0,
                  },
                ]}
                extraLegendItems={[
                  {
                    label: 'Simulated - additional usage',
                    color: SIMULATED_ADDITIONAL_COLOR,
                    legendOrder: 2,
                  },
                ]}
                formatYAsCurrency
                height={320}
              />
            )}

            <div className="bg-bg-default border border-border-default rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-border-default text-xs font-bold tracking-[0.05em] uppercase text-fg-muted bg-bg-muted">
                Limits reached in this simulation
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={th}>Budget limit</th>
                      <th className={th}>Block date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isIndividualReport && (
                      <tr>
                        <td className={td}>First user-level budget block</td>
                        <td className={`${td} font-semibold text-fg-default`}>{formatSimulationDate(budgetSimulation.firstUserBlockedDate)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className={td}>{isIndividualReport ? 'Additional usage budget' : 'Account-level budget'} blocked all remaining usage</td>
                      <td className={`${td} font-semibold text-fg-default`}>{formatSimulationDate(budgetSimulation.accountBlockedDate)}</td>
                    </tr>
                    {!isIndividualReport && PRODUCT_SIMULATION_DETAILS.map((product) => (
                      <tr key={product.key}>
                        <td className={td}>{product.label} budget block</td>
                        <td className={`${td} font-semibold text-fg-default`}>{formatSimulationDate(budgetSimulation.productBlockedDates[product.key] ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-bg-default border border-border-default rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-border-default text-xs font-bold tracking-[0.05em] uppercase text-fg-muted bg-bg-muted">
                Blocked usage summary
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={th}>Metric</th>
                      <th className={thNum}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isIndividualReport && (
                      <tr>
                        <td className={td}>Blocked users</td>
                        <td className={`${tdNum} font-semibold text-fg-default`}>{budgetSimulation.blockedUsers.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr>
                      <td className={td}>Blocked PRUs</td>
                      <td className={`${tdNum} font-semibold text-fg-default`}>{budgetSimulation.blockedRequests.toLocaleString()}</td>
                    </tr>
                    {!isIndividualReport && (
                      <tr>
                        <td className={td}>Included credits blocked by user budgets</td>
                        <td className={`${tdNum} font-semibold text-fg-default`}>{formatAic(budgetSimulation.blockedIncludedCreditsAic)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
