import { useMemo } from 'react'
import { DualAxisLineChart, MultiSeriesStackedBarChart, ProductUsageTable, type LineSeries, type ProductUsageTableProduct } from '../components'
import { getPlanLabel, type ReportPlanScope } from '../pipeline/aicIncludedCredits'
import type { UserDailyUsage, UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { fillDataForRange } from '../utils/fillDataForRange'
import { formatAic } from '../utils/format'
import { BillingProjectionDisclaimer, NegotiatedDiscountDisclaimer, PromotionalDataDisclaimer } from '../components/ui'
import { th, thNum, td, tdNum } from '../components/ui/tableStyles'

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
  showUsersBreadcrumb?: boolean
  rangeStart?: string | null
  rangeEnd?: string | null
  onBackToUsers?: () => void
}

export function UserDetailsView({
  user,
  reportPlanScope = 'organization',
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

  const cumulativeNetCostSeries = useMemo<[LineSeries, LineSeries]>(() => {
    return [
      {
        label: 'PRU Net Cost',
        color: '#cf222e',
        data: chartDailyEntries.reduce<number[]>((acc, day) => {
          acc.push((acc[acc.length - 1] ?? 0) + day.netAmount)
          return acc
        }, []),
        yAxisID: 'y',
      },
      {
        label: 'AIC Net Cost',
        color: '#54aeff',
        data: chartDailyEntries.reduce<number[]>((acc, day) => {
          acc.push((acc[acc.length - 1] ?? 0) + day.aicNetAmount)
          return acc
        }, []),
        yAxisID: 'y',
      },
    ]
  }, [chartDailyEntries])

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

  const productBreakdownRows = useMemo<ProductUsageTableProduct[]>(() => {
    if (!user) return []
    return Object.entries(user.products)
      .map(([product, usage]) => ({ product, totals: usage.totals, models: usage.models }))
      .sort((a, b) => {
        const costDiff = b.totals.netAmount - a.totals.netAmount
        return costDiff !== 0 ? costDiff : a.product.localeCompare(b.product)
      })
  }, [user])

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null

  const aicDiscountAmount = user ? calculateAicDiscountAmount(user.totals.aicGrossAmount, user.totals.aicNetAmount) : 0
  const savings = user ? calculateSavingsDifference(user.totals.netAmount, user.totals.aicNetAmount) : 0
  const planLabel = user ? getPlanLabel(user.totalMonthlyQuota, reportPlanScope) : null
  const showNegotiatedDiscountDisclaimer = reportPlanScope !== 'individual'

  if (!user) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <h2 className="m-0 text-lg font-semibold text-fg-default">User Details</h2>
        </div>
        <div className="bg-bg-default border border-border-default rounded-md p-4 text-fg-muted">Select a user from the list to view details.</div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {showUsersBreadcrumb ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2.5 flex-wrap list-none m-0 p-0">
                <li className="inline-flex items-center gap-2.5 after:content-['/'] after:text-lg after:font-semibold after:text-fg-muted">
                  {onBackToUsers ? (
                    <button type="button" className="font-[inherit] text-lg font-semibold text-fg-accent bg-transparent border-none p-0 m-0 leading-[1.2] cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-fg-accent focus-visible:outline-offset-[3px] focus-visible:rounded-sm" onClick={onBackToUsers}>
                      users
                    </button>
                  ) : (
                    <span className="font-[inherit] text-lg font-semibold text-fg-muted bg-transparent border-none p-0 m-0 leading-[1.2]">users</span>
                  )}
                </li>
                <li className="inline-flex items-center text-fg-default" aria-current="page">
                  <h2 className="m-0 text-lg font-semibold text-inherit">{user.username}</h2>
                </li>
              </ol>
            </nav>
          ) : (
            <h2 className="m-0 text-lg font-semibold text-fg-default">{user.username}</h2>
          )}
        </div>

        <div className="flex items-center gap-3 gap-y-2 flex-wrap">
          {planLabel && <span className="text-sm text-fg-muted whitespace-nowrap [&:not(:last-child)]:after:content-['|'] [&:not(:last-child)]:after:ml-3 [&:not(:last-child)]:after:text-fg-muted">Plan: {planLabel}</span>}
          {user.organizations.length > 0 && <span className="text-sm text-fg-muted whitespace-nowrap [&:not(:last-child)]:after:content-['|'] [&:not(:last-child)]:after:ml-3 [&:not(:last-child)]:after:text-fg-muted">Organizations: {joinValues(user.organizations)}</span>}
          {user.costCenters.length > 0 && <span className="text-sm text-fg-muted whitespace-nowrap [&:not(:last-child)]:after:content-['|'] [&:not(:last-child)]:after:ml-3 [&:not(:last-child)]:after:text-fg-muted">Cost Centers: {joinValues(user.costCenters)}</span>}
          <span className="text-sm text-fg-muted whitespace-nowrap [&:not(:last-child)]:after:content-['|'] [&:not(:last-child)]:after:ml-3 [&:not(:last-child)]:after:text-fg-muted">Days Active: {formatInt(activeDailyEntries.length)}</span>
        </div>
      </div>

      {labels.length === 0 ? (
        <div className="bg-bg-default border border-border-default rounded-md p-4 text-fg-muted">No usage data for this user.</div>
      ) : (
        <>
          {periodLabel && (
            <p className="text-base font-normal text-center mb-1 text-fg-default">
              {savings > 0 ? (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatCost(savings)} less</strong> under usage-based billing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatCost(Math.abs(savings))} more</strong> under usage-based billing
                </>
              ) : (
                <>
                  <strong>{user.username}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under usage-based billing
                </>
              )}
            </p>
          )}

          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-3">
            <div className="bg-bg-default border border-border-default rounded-md px-5 py-7 text-center">
              <div className="text-[13px] font-medium text-fg-muted uppercase tracking-wider mb-3">Current billing (PRUs)</div>
              <div className="text-4xl font-bold leading-[1.2] text-fg-default">{formatCost(user.totals.netAmount)}</div>
              <div className="text-sm text-fg-default mt-1.5">{user.totals.requests.toLocaleString()} PRUs</div>
              <div className="text-xs text-fg-muted mt-1">1 PRU = $0.04</div>
              <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>Consumed PRUs</span>
                  <span>{formatCost(user.totals.grossAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                  <span>Included PRUs</span>
                  <span>−{formatCost(user.totals.discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                  <span>Overages</span>
                  <span>{formatCost(user.totals.netAmount)}</span>
                </div>
                {showNegotiatedDiscountDisclaimer && <NegotiatedDiscountDisclaimer />}
              </div>
            </div>
            <div className="bg-bg-default border border-border-default rounded-md px-5 py-7 text-center">
              <div className="text-[13px] font-medium text-fg-muted uppercase tracking-wider mb-3">Usage-based billing (AICs)</div>
              <div className="text-4xl font-bold leading-[1.2] text-app-savings-fg">{formatCost(user.totals.aicNetAmount)}</div>
              <div className="text-sm text-fg-default mt-1.5">{formatAic(user.totals.aicQuantity)} AICs</div>
              <div className="text-xs text-fg-muted mt-1">1 AIC = $0.01</div>
              <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>Consumed AICs</span>
                  <span>{formatCost(user.totals.aicGrossAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                  <span>Included AICs</span>
                  <span>−{formatCost(aicDiscountAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                  <span>Additional usage</span>
                  <span>{formatCost(user.totals.aicNetAmount)}</span>
                </div>
                {showNegotiatedDiscountDisclaimer ? <NegotiatedDiscountDisclaimer /> : <PromotionalDataDisclaimer />}
              </div>
            </div>
          </div>
          <BillingProjectionDisclaimer className="mb-6" />

          <div className="grid grid-cols-1 gap-6 w-full">
            {productBreakdownRows.length > 0 && (
              <ProductUsageTable title="Usage by Product" products={productBreakdownRows} />
            )}
            <MultiSeriesStackedBarChart title="Daily Requests by Model" labels={labels} series={requestSeries} height={340} />
            <MultiSeriesStackedBarChart title="Daily AI Credits by Model" labels={labels} series={aicSeries} height={340} />
            <DualAxisLineChart
              title="Cumulative net cost: PRU vs AIC"
              labels={labels}
              series={cumulativeNetCostSeries}
              formatYAsCurrency
              height={320}
            />
          </div>

          <div className="bg-bg-default border border-border-default rounded-md overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Model</th>
                  <th className={thNum}>PRUs</th>
                  <th className={thNum}>AICs</th>
                  <th className={thNum}>PRU Net Cost</th>
                  <th className={thNum}>AIC Net Cost</th>
                  <th className={thNum}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {dailySummaryGroups.flatMap((group) =>
                  group.rows.map((row, rowIndex) => {
                    const diff = calculateSavingsDifference(row.netAmount, row.aicNetAmount)

                    return (
                      <tr key={`${group.date}-${row.model}`}>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className={`${td} align-top font-semibold text-fg-default bg-bg-inset`}>
                            {group.date}
                          </td>
                        )}
                        <td className={`${td} font-medium text-fg-default`}>{`- ${row.model}`}</td>
                        <td className={tdNum}>{formatInt(row.requests)}</td>
                        <td className={tdNum}>{formatAic(row.aicQuantity)}</td>
                        <td className={tdNum}>{formatCost(row.netAmount)}</td>
                        <td className={tdNum}>{formatCost(row.aicNetAmount)}</td>
                        <td className={`${tdNum} font-semibold ${diff > 0 ? 'text-app-savings-fg' : diff < 0 ? 'text-app-overspend-fg' : 'text-fg-muted'}`}>
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
