import { useMemo } from 'react'
import { MultiSeriesStackedBarChart } from '../components'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { formatAiu } from '../utils/format'

type DailySummaryModelRow = {
  model: string
  requests: number
  aiuQuantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
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

export interface UserDetailsViewProps {
  user: UserUsage | null
}

export function UserDetailsView({ user }: UserDetailsViewProps) {
  const dailyEntries = useMemo(() => {
    if (!user) return []
    return Object.values(user.daily).sort((a, b) => a.date.localeCompare(b.date))
  }, [user])

  const modelNames = useMemo(() => {
    const names = new Set<string>()
    for (const day of dailyEntries) {
      for (const model of Object.keys(day.models)) {
        names.add(model)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [dailyEntries])

  const labels = useMemo(() => dailyEntries.map((day) => day.date), [dailyEntries])

  const requestSeries = useMemo(() => {
    return modelNames.map((model, index) => ({
      label: model,
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      data: dailyEntries.map((day) => day.models[model]?.requests ?? 0),
    }))
  }, [dailyEntries, modelNames])

  const aiuSeries = useMemo(() => {
    return modelNames.map((model, index) => ({
      label: model,
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      data: dailyEntries.map((day) => day.models[model]?.aiuQuantity ?? 0),
    }))
  }, [dailyEntries, modelNames])

  const dailySummaryGroups = useMemo(() => {
    const groups: DailySummaryGroup[] = []
    for (const day of dailyEntries) {
      const dayModelNames = Object.keys(day.models).sort((a, b) => a.localeCompare(b))
      const rows: DailySummaryModelRow[] = []

      for (const model of dayModelNames) {
        const usage = day.models[model]
        rows.push({
          model,
          requests: usage.requests,
          aiuQuantity: usage.aiuQuantity,
          grossAmount: usage.grossAmount,
          discountAmount: usage.discountAmount,
          netAmount: usage.netAmount,
        })
      }

      groups.push({ date: day.date, rows })
    }

    return groups
  }, [dailyEntries])

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
        <div className="user-details__title">
          <h2 className="user-details__heading">{user.username}</h2>
        </div>
      </div>

      <div className="user-details__summaryWrap">
        <table className="user-details__summaryTable" aria-label="User summary">
          <tbody>
            <tr>
              <th>Days Active</th>
              <td>{formatInt(dailyEntries.length)}</td>
            </tr>
            <tr>
              <th>Models Used</th>
              <td>{formatInt(modelNames.length)}</td>
            </tr>
            <tr>
              <th>Requests</th>
              <td>{formatInt(user.totals.requests)}</td>
            </tr>
            <tr>
              <th>AI Credits</th>
              <td>{formatAiu(user.totals.aiuQuantity)}</td>
            </tr>
            <tr>
              <th>Gross Cost</th>
              <td>{formatCost(user.totals.grossAmount)}</td>
            </tr>
            <tr>
              <th>Net Cost</th>
              <td>{formatCost(user.totals.netAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {labels.length === 0 ? (
        <div className="user-details__empty">No usage data for this user.</div>
      ) : (
        <>
          <div className="charts-grid">
            <MultiSeriesStackedBarChart title="Daily Requests by Model" labels={labels} series={requestSeries} height={340} />
            <MultiSeriesStackedBarChart title="Daily AI Credits by Model" labels={labels} series={aiuSeries} height={340} />
          </div>

          <div className="user-details__tableWrap data-table-wrap">
            <table className="user-details__table data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Model</th>
                  <th className="user-details__num">Requests</th>
                  <th className="user-details__num">AI Credits</th>
                  <th className="user-details__num">Gross Cost</th>
                  <th className="user-details__num">Discounts</th>
                  <th className="user-details__num">Net Cost</th>
                </tr>
              </thead>
              <tbody>
                {dailySummaryGroups.flatMap((group) =>
                  group.rows.map((row, rowIndex) => (
                    <tr key={`${group.date}-${row.model}`}>
                      {rowIndex === 0 && (
                        <td rowSpan={group.rows.length} className="user-details__date">
                          {group.date}
                        </td>
                      )}
                      <td className="user-details__model">{`- ${row.model}`}</td>
                      <td className="user-details__num">{formatInt(row.requests)}</td>
                      <td className="user-details__num">{formatAiu(row.aiuQuantity)}</td>
                      <td className="user-details__num">{formatCost(row.grossAmount)}</td>
                      <td className="user-details__num">{formatCost(row.discountAmount)}</td>
                      <td className="user-details__num">{formatCost(row.netAmount)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
