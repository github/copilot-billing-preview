import { useMemo, useState } from 'react'
import type { CostCenterResult, CostTotals } from '../pipeline/aggregators/costCenterAggregator'
import { CostBreakdownCard } from '../components'

function formatUsd(n: number): string {
  return `$ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function includedFrom(t: CostTotals): number {
  return t.grossAmount - t.netAmount
}

export function CostCentersView({ data }: { data: CostCenterResult }) {
  const [selected, setSelected] = useState<string>(data.costCenters[0]?.costCenterName ?? '')

  const selectedCostCenter = useMemo(() => {
    return data.costCenters.find((c) => c.costCenterName === selected) ?? null
  }, [data.costCenters, selected])

  const modelRows = useMemo(() => {
    if (!selectedCostCenter) return []
    return Object.entries(selectedCostCenter.totalsByModel)
      .map(([model, totals]) => ({ model, totals }))
      .sort((a, b) => b.totals.netAmount - a.totals.netAmount)
  }, [selectedCostCenter])

  const userRows = useMemo(() => {
    if (!selectedCostCenter) return []
    return Object.entries(selectedCostCenter.netByUser)
      .map(([username, netAmount]) => ({ username, netAmount }))
      .sort((a, b) => b.netAmount - a.netAmount)
  }, [selectedCostCenter])

  if (data.costCenters.length === 0) {
    return (
      <section className="cost-centers-view">
        <h2 className="cost-centers-view__heading">Cost Centers</h2>
        <div className="cost-centers-view__empty">No cost centers found in this report.</div>
      </section>
    )
  }

  return (
    <section className="cost-centers-view">
      <div className="cost-centers-view__header">
        <div className="cost-centers-view__title">
          <h2 className="cost-centers-view__heading">Cost Centers</h2>
          <span className="cost-centers-view__count">{data.costCenters.length.toLocaleString()} total</span>
        </div>
        <select className="cost-centers-view__select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {data.costCenters.map((c) => (
            <option key={c.costCenterName} value={c.costCenterName}>
              {c.costCenterName}
            </option>
          ))}
        </select>
      </div>

      {selectedCostCenter && (
        <CostBreakdownCard
          items={[
            {
              label: 'Gross Cost',
              value: formatUsd(selectedCostCenter.totals.grossAmount),
            },
            {
              label: 'Included',
              value: formatUsd(includedFrom(selectedCostCenter.totals)),
              variant: 'muted',
            },
            {
              label: 'Net Cost',
              value: formatUsd(selectedCostCenter.totals.netAmount),
              variant: 'highlight',
            },
          ]}
        />
      )}

      <div className="cost-centers-view__tables">
        <div className="cost-centers-view__tableWrap">
          <div className="cost-centers-view__tableTitle">Per user (net)</div>
          <table className="cost-centers-view__table">
            <thead>
              <tr>
                <th>User</th>
                <th className="cost-centers-view__num">Net Cost</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((r) => (
                <tr key={r.username}>
                  <td className="cost-centers-view__name">{r.username}</td>
                  <td className="cost-centers-view__num">{formatUsd(r.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cost-centers-view__tableWrap">
          <div className="cost-centers-view__tableTitle">Per model</div>
          <table className="cost-centers-view__table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="cost-centers-view__num">Gross</th>
                <th className="cost-centers-view__num">Included</th>
                <th className="cost-centers-view__num">Net</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((r) => (
                <tr key={r.model}>
                  <td className="cost-centers-view__name">{r.model}</td>
                  <td className="cost-centers-view__num">{formatUsd(r.totals.grossAmount)}</td>
                  <td className="cost-centers-view__num">{formatUsd(includedFrom(r.totals))}</td>
                  <td className="cost-centers-view__num">{formatUsd(r.totals.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
