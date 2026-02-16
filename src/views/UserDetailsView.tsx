import { useMemo } from 'react'
import { MultiSeriesStackedBarChart } from '../components'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import type { CostCalculator } from '../pipeline/costCalculator'

type DailySummaryModelRow = {
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  pruGrossCost: number
  tokenBasedCost: number | null
  grossDiff: number | null
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
  costCalculator: CostCalculator | null
  onBack: () => void
}

export function UserDetailsView({ user, costCalculator, onBack }: UserDetailsViewProps) {
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

  const tokenSeries = useMemo(() => {
    return modelNames.map((model, index) => ({
      label: model,
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      data: dailyEntries.map((day) => {
        const usage = day.models[model]
        if (!usage) return 0
        return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens
      }),
    }))
  }, [dailyEntries, modelNames])

  const dailySummaryGroups = useMemo(() => {
    const groups: DailySummaryGroup[] = []
    for (const day of dailyEntries) {
      const dayModelNames = Object.keys(day.models).sort((a, b) => a.localeCompare(b))
      const rows: DailySummaryModelRow[] = []

      for (const model of dayModelNames) {
        const usage = day.models[model]
        const tokenBasedCost = costCalculator
          ? costCalculator.calculate(model, {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              cacheReadTokens: usage.cacheReadTokens,
            }).totalCost
          : null
        const grossDiff = tokenBasedCost === null ? null : tokenBasedCost - usage.grossAmount

        rows.push({
          model,
          requests: usage.requests,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          pruGrossCost: usage.grossAmount,
          tokenBasedCost,
          grossDiff,
        })
      }

      groups.push({ date: day.date, rows })
    }

    return groups
  }, [costCalculator, dailyEntries])

  const summaryPruGrossCost = user?.totals.grossAmount ?? 0
  const summaryAiUnitGrossCost = useMemo(() => {
    if (!costCalculator) return null
    return dailySummaryGroups.reduce((total, group) => {
      return total + group.rows.reduce((rowTotal, row) => rowTotal + (row.tokenBasedCost ?? 0), 0)
    }, 0)
  }, [costCalculator, dailySummaryGroups])

  if (!user) {
    return (
      <section className="user-details">
        <div className="user-details__header">
          <h2 className="user-details__heading">User Details</h2>
          <button className="secondary-header__button" onClick={onBack}>
            Back to users
          </button>
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
        <button className="secondary-header__button" onClick={onBack}>
          Back to users
        </button>
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
              <th>PRU Gross Cost</th>
              <td>{formatCost(summaryPruGrossCost)}</td>
            </tr>
            <tr>
              <th>AI Units Gross Cost</th>
              <td>{summaryAiUnitGrossCost === null ? '—' : formatCost(summaryAiUnitGrossCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {labels.length === 0 ? (
        <div className="user-details__empty">No usage data for this user.</div>
      ) : (
        <>
          <div className="charts-grid">
            <MultiSeriesStackedBarChart title="Daily PRUs by Model" labels={labels} series={requestSeries} height={340} />
            <MultiSeriesStackedBarChart
              title="Daily Billable Token Ops by Model"
              labels={labels}
              series={tokenSeries}
              height={340}
            />
          </div>

          <div className="user-details__tableWrap">
            <table className="user-details__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Model</th>
                  <th className="user-details__num">Requests</th>
                  <th className="user-details__num">Input Tokens</th>
                  <th className="user-details__num">Output Tokens</th>
                  <th className="user-details__num">Cache Read Tokens</th>
                  <th className="user-details__num">PRU Gross Cost</th>
                  <th className="user-details__num">AI Unit Cost</th>
                  <th className="user-details__num">Gross Diff</th>
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
                      <td className="user-details__num">{formatInt(row.inputTokens)}</td>
                      <td className="user-details__num">{formatInt(row.outputTokens)}</td>
                      <td className="user-details__num">{formatInt(row.cacheReadTokens)}</td>
                      <td className="user-details__num">{formatCost(row.pruGrossCost)}</td>
                      <td className="user-details__num">
                        {row.tokenBasedCost === null ? '—' : formatCost(row.tokenBasedCost)}
                      </td>
                      <td
                        className={`user-details__num ${
                          row.grossDiff === null
                            ? ''
                            : row.grossDiff <= 0
                              ? 'user-details__diff--positive'
                              : 'user-details__diff--negative'
                        }`}
                      >
                        {row.grossDiff === null ? '—' : formatCost(row.grossDiff)}
                      </td>
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
