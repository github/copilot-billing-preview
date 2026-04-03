import { useMemo } from 'react'
import { MultiSeriesStackedBarChart } from '../components'
import { getPlanLabel, type ReportPlanScope } from '../pipeline/aicEntitlements'
import type { UserDailyUsage, UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAic } from '../utils/format'
import type { CostOptimizationOpportunity } from '../utils/costOptimization'

type DailySummaryModelRow = {
  model: string
  requests: number
  aicQuantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicGrossAmount: number
  aicDiscountAmount: number
  aicNetAmount: number
}

type DailySummaryGroup = {
  date: string
  rows: DailySummaryModelRow[]
}

const MODEL_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#10b981',
  '#f97316',
  '#a855f7',
  '#3b82f6',
]

function formatInt(n: number): string {
  return n.toLocaleString()
}

function formatCost(n: number): string {
  const sign = n < 0 ? '-' : ''
  const absValue = Math.abs(n)
  return `${sign}$${absValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function joinValues(values: string[]): string {
  return values.join(', ')
}

function createEmptyUserDaily(date: string): UserDailyUsage {
  return { date, requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0, aicQuantity: 0, aicGrossAmount: 0, aicNetAmount: 0, models: {} }
}

export interface UserDetailsViewProps {
  user: UserUsage | null
  reportPlanScope?: ReportPlanScope
  costOptimizationOpportunity?: CostOptimizationOpportunity
  showUsersBreadcrumb?: boolean
  rangeStart?: string | null
  rangeEnd?: string | null
  onBackToUsers?: () => void
}

export function UserDetailsView({
  user,
  reportPlanScope = 'organization',
  costOptimizationOpportunity,
  showUsersBreadcrumb = true,
  rangeStart,
  rangeEnd,
  onBackToUsers,
}: UserDetailsViewProps) {
  const activeDailyEntries = useMemo(() => {
    if (!user) return []
    return Object.values(user.daily).sort((a, b) => a.date.localeCompare(b.date))
  }, [user])

  const chartDailyEntries = useMemo(
    () => fillDataForRange(activeDailyEntries, rangeStart ?? null, rangeEnd ?? null, createEmptyUserDaily),
    [activeDailyEntries, rangeStart, rangeEnd],
  )

  const modelNames = useMemo(() => {
    const names = new Set<string>()
    for (const day of activeDailyEntries) {
      for (const model of Object.keys(day.models)) {
        names.add(model)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [activeDailyEntries])

  const labels = useMemo(() => chartDailyEntries.map((day) => day.date), [chartDailyEntries])

  const requestSeries = useMemo(() => {
    return modelNames.map((model, index) => ({
      label: model,
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      data: chartDailyEntries.map((day) => day.models[model]?.requests ?? 0),
    }))
  }, [chartDailyEntries, modelNames])

  const aicSeries = useMemo(() => {
    return modelNames.map((model, index) => ({
      label: model,
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      data: chartDailyEntries.map((day) => day.models[model]?.aicQuantity ?? 0),
    }))
  }, [chartDailyEntries, modelNames])

  const dailySummaryGroups = useMemo(() => {
    const groups: DailySummaryGroup[] = []
    for (const day of activeDailyEntries) {
      const dayModelNames = Object.keys(day.models).sort((a, b) => a.localeCompare(b))
      const rows: DailySummaryModelRow[] = []

      for (const model of dayModelNames) {
        const usage = day.models[model]
        rows.push({
          model,
          requests: usage.requests,
          aicQuantity: usage.aicQuantity,
          grossAmount: usage.grossAmount,
          discountAmount: usage.discountAmount,
          netAmount: usage.netAmount,
          aicGrossAmount: usage.aicGrossAmount,
          aicDiscountAmount: calculateAicDiscountAmount(usage.aicGrossAmount, usage.aicNetAmount),
          aicNetAmount: usage.aicNetAmount,
        })
      }

      groups.push({ date: day.date, rows })
    }

    return groups
  }, [activeDailyEntries])

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null

  const aicDiscountAmount = user ? calculateAicDiscountAmount(user.totals.aicGrossAmount, user.totals.aicNetAmount) : 0
  const savings = user ? calculateSavingsDifference(user.totals.netAmount, user.totals.aicNetAmount) : 0
  const planLabel = user ? getPlanLabel(user.totalMonthlyQuota, reportPlanScope) : null

  if (!user) {
    return (
      <section className="user-details">
        <div className="user-details__header">
          <h2 className="user-details__heading">User Details</h2>
        </div>
        <div className="user-details__empty">Select a user from the list to view details.</div>
      </section>
    )
  }

  return (
    <section className="user-details">
      <div className="user-details__header">
        <div className="user-details__titleGroup">
          {showUsersBreadcrumb ? (
            <nav aria-label="Breadcrumb">
              <ol className="user-details__breadcrumbs">
                <li className="user-details__breadcrumbItem">
                  {onBackToUsers ? (
                    <button type="button" className="user-details__breadcrumb user-details__breadcrumb--link" onClick={onBackToUsers}>
                      users
                    </button>
                  ) : (
                    <span className="user-details__breadcrumb">users</span>
                  )}
                </li>
                <li className="user-details__breadcrumbItem user-details__breadcrumbItem--current" aria-current="page">
                  <h2 className="user-details__heading">{user.username}</h2>
                </li>
              </ol>
            </nav>
          ) : (
            <h2 className="user-details__heading">{user.username}</h2>
          )}
        </div>

        <div className="user-details__metaRow">
          {planLabel && <span className="user-details__meta">Plan: {planLabel}</span>}
          {user.organizations.length > 0 && <span className="user-details__meta">Organizations: {joinValues(user.organizations)}</span>}
          {user.costCenters.length > 0 && <span className="user-details__meta">Cost Centers: {joinValues(user.costCenters)}</span>}
          <span className="user-details__meta">Days Active: {formatInt(activeDailyEntries.length)}</span>
        </div>
      </div>

      {labels.length === 0 ? (
        <div className="user-details__empty">No usage data for this user.</div>
      ) : (
        <>
          {periodLabel && (
            <p className="comparison-framing">
              {savings > 0 ? (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatCost(savings)} less</strong> under AI Credits-based billing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatCost(Math.abs(savings))} more</strong> under AI Credits-based billing
                </>
              ) : (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under AI Credits-based billing
                </>
              )}
            </p>
          )}

          <div className="comparison-grid">
            <div className="card comparison-card">
              <div className="comparison-card__label">Current billing (PRUs)</div>
              <div className="comparison-card__big-number">{formatCost(user.totals.netAmount)}</div>
              <div className="comparison-card__period">{user.totals.requests.toLocaleString()} PRUs</div>
              <div className="comparison-card__rate">1 PRU = $0.04</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatCost(user.totals.grossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Discounts</span>
                  <span>−{formatCost(user.totals.discountAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatCost(user.totals.netAmount)}</span>
                </div>
              </div>
            </div>
            <div className="card comparison-card">
              <div className="comparison-card__label">AI Credits-based billing (AICs)</div>
              <div className="comparison-card__big-number comparison-card__big-number--aic">{formatCost(user.totals.aicNetAmount)}</div>
              <div className="comparison-card__period">{formatAic(user.totals.aicQuantity)} AICs</div>
              <div className="comparison-card__rate">1 AIC = $0.01</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatCost(user.totals.aicGrossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Included credits discount</span>
                  <span>−{formatCost(aicDiscountAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatCost(user.totals.aicNetAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {reportPlanScope === 'individual' && costOptimizationOpportunity?.hasPotentialCostOptimizationOpportunity && (
            <div className="entitlement-banner">
              <div className="entitlement-banner__body">
                <strong className="entitlement-banner__title">Cost optimization opportunity</strong>
                <p className="entitlement-banner__text">
                  Your usage is generating <strong>{formatCost(costOptimizationOpportunity.estimatedAicNetCost)}</strong> in AIC overage charges.
                  Upgrading from <strong>Copilot Pro/Student</strong> to <strong>Copilot Pro+</strong>
                  would add <strong>{formatAic(costOptimizationOpportunity.extraAicCreditsFromSuggestedUpgrades)}</strong> more included AICs per week
                  and reduce total cost from{' '}
                  <strong>{formatCost(costOptimizationOpportunity.estimatedAicNetCost)}</strong> to{' '}
                  <strong>{formatCost(costOptimizationOpportunity.estimatedAicNetCostAfterSuggestedUpgrades)}</strong>{' '}
                  (including <strong>{formatCost(costOptimizationOpportunity.estimatedUpgradeCost)}</strong> in upgrade cost) —
                  saving <strong>{formatCost(costOptimizationOpportunity.estimatedSavings)}</strong>.
                </p>
              </div>
              <a
                href="https://docs.github.com/billing/managing-your-copilot-usage"
                className="entitlement-banner__link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Upgrade plan &rarr;
              </a>
            </div>
          )}

          <div className="charts-grid">
            <MultiSeriesStackedBarChart title="Daily Requests by Model" labels={labels} series={requestSeries} height={340} />
            <MultiSeriesStackedBarChart title="Daily AI Credits by Model" labels={labels} series={aicSeries} height={340} />
          </div>

          <div className="user-details__tableWrap data-table-wrap">
            <table className="user-details__table data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Model</th>
                  <th className="user-details__num">Requests</th>
                  <th className="user-details__num">Gross Cost (PRU)</th>
                  <th className="user-details__num">Discounts (PRU)</th>
                  <th className="user-details__num">Net Cost (PRU)</th>
                  <th className="user-details__num">AICs</th>
                  <th className="user-details__num">Gross Cost (AIC)</th>
                  <th className="user-details__num">Discounts (AIC)</th>
                  <th className="user-details__num">Net Cost (AIC)</th>
                  <th className="user-details__num">Difference</th>
                </tr>
              </thead>
              <tbody>
                {dailySummaryGroups.flatMap((group) =>
                  group.rows.map((row, rowIndex) => {
                    const diff = calculateSavingsDifference(row.netAmount, row.aicNetAmount)

                    return (
                      <tr key={`${group.date}-${row.model}`}>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className="user-details__date">
                            {group.date}
                          </td>
                        )}
                        <td className="user-details__model">{`- ${row.model}`}</td>
                        <td className="user-details__num">{formatInt(row.requests)}</td>
                        <td className="user-details__num">{formatCost(row.grossAmount)}</td>
                        <td className="user-details__num">{formatCost(row.discountAmount)}</td>
                        <td className="user-details__num">{formatCost(row.netAmount)}</td>
                        <td className="user-details__num">{formatAic(row.aicQuantity)}</td>
                        <td className="user-details__num">{formatCost(row.aicGrossAmount)}</td>
                        <td className="user-details__num">{formatCost(row.aicDiscountAmount)}</td>
                        <td className="user-details__num">{formatCost(row.aicNetAmount)}</td>
                        <td className={`user-details__num ${diff > 0 ? 'user-details__diff--positive' : diff < 0 ? 'user-details__diff--negative' : 'user-details__diff--neutral'}`}>
                          {diff > 0 ? '−' : diff < 0 ? '+' : ''}
                          {formatCost(Math.abs(diff))}
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
