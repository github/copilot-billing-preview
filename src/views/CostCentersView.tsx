import { useMemo, useState } from 'react'
import type { CostCenterResult } from '../pipeline/aggregators/costCenterAggregator'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { formatAic, formatDifference, formatUsd } from '../utils/format'

export function CostCentersView({ data, rangeStart }: { data: CostCenterResult; rangeStart?: string | null }) {
  const [selected, setSelected] = useState<string>(data.costCenters[0]?.costCenterName ?? '')

  const selectedCostCenter = useMemo(() => {
    return data.costCenters.find((costCenter) => costCenter.costCenterName === selected) ?? null
  }, [data.costCenters, selected])

  const modelRows = useMemo(() => {
    if (!selectedCostCenter) return []
    return Object.entries(selectedCostCenter.totalsByModel)
      .map(([model, totals]) => ({ model, totals }))
      .sort((a, b) => b.totals.netAmount - a.totals.netAmount)
  }, [selectedCostCenter])

  const userRows = useMemo(() => {
    if (!selectedCostCenter) return []
    return Object.entries(selectedCostCenter.totalsByUser)
      .map(([username, totals]) => ({ username, totals }))
      .sort((a, b) => b.totals.netAmount - a.totals.netAmount)
  }, [selectedCostCenter])

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null

  if (data.costCenters.length === 0) {
    return (
      <section className="cost-centers-view">
        <h2 className="cost-centers-view__heading">Cost Centers</h2>
        <div className="cost-centers-view__empty">No cost centers found in this report.</div>
      </section>
    )
  }

  const totals = selectedCostCenter?.totals
  const aicDiscountAmount = totals ? calculateAicDiscountAmount(totals.aicGrossAmount, totals.aicNetAmount) : 0
  const savings = totals ? calculateSavingsDifference(totals.netAmount, totals.aicNetAmount) : 0
  const hasCosts = totals && (totals.grossAmount > 0 || totals.aicGrossAmount > 0)

  return (
    <section className="cost-centers-view">
      <div className="cost-centers-view__header">
        <div className="cost-centers-view__title">
          <h2 className="cost-centers-view__heading">Cost Centers</h2>
          <span className="cost-centers-view__count">{data.costCenters.length.toLocaleString()} total</span>
        </div>
        <select className="cost-centers-view__select" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {data.costCenters.map((costCenter) => (
            <option key={costCenter.costCenterName} value={costCenter.costCenterName}>
              {costCenter.costCenterName}
            </option>
          ))}
        </select>
      </div>

      {selectedCostCenter && totals && (
        <>
          {hasCosts && periodLabel && (
            <p className="comparison-framing">
              {savings > 0 ? (
                <>
                  <strong>{selected}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under token-based pricing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{selected}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under token-based pricing
                </>
              ) : (
                <>
                  <strong>{selected}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under token-based pricing
                </>
              )}
            </p>
          )}

          <div className="comparison-grid">
            <div className="card comparison-card">
              <div className="comparison-card__label">Current billing (PRUs)</div>
              <div className="comparison-card__big-number">{formatUsd(totals.netAmount)}</div>
              <div className="comparison-card__period">{totals.requests.toLocaleString()} PRUs</div>
              <div className="comparison-card__rate">1 PRU = $0.04</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatUsd(totals.grossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Discounts</span>
                  <span>−{formatUsd(totals.discountAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatUsd(totals.netAmount)}</span>
                </div>
              </div>
            </div>
            <div className="card comparison-card">
              <div className="comparison-card__label">Token-based billing (AICs)</div>
              <div className="comparison-card__big-number comparison-card__big-number--aic">{formatUsd(totals.aicNetAmount)}</div>
              <div className="comparison-card__period">{formatAic(totals.aicQuantity)} AICs</div>
              <div className="comparison-card__rate">1 AIC = $0.01</div>
              <div className="comparison-card__breakdown">
                <div className="comparison-card__breakdown-row">
                  <span>Gross cost</span>
                  <span>{formatUsd(totals.aicGrossAmount)}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--muted">
                  <span>Included credits discount</span>
                  <span>−{formatUsd(Math.abs(aicDiscountAmount))}</span>
                </div>
                <div className="comparison-card__breakdown-row comparison-card__breakdown-row--total">
                  <span>Net cost</span>
                  <span>{formatUsd(totals.aicNetAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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

      <div className="cost-centers-view__tables">
          <div className="cost-centers-view__tableWrap data-table-wrap">
          <div className="cost-centers-view__tableTitle">Per model</div>
          <table className="cost-centers-view__table data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th className="cost-centers-view__num">PRUs</th>
                <th className="cost-centers-view__num">PRU Cost</th>
                <th className="cost-centers-view__num">AICs</th>
                <th className="cost-centers-view__num">AIC Cost</th>
                <th className="cost-centers-view__num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((row) => {
                const diff = calculateSavingsDifference(row.totals.netAmount, row.totals.aicNetAmount)
                return (
                  <tr key={row.model}>
                    <td className="cost-centers-view__name">{row.model}</td>
                    <td className="cost-centers-view__num">{row.totals.requests.toLocaleString()}</td>
                    <td className="cost-centers-view__num">{formatUsd(row.totals.netAmount)}</td>
                    <td className="cost-centers-view__num">{formatAic(row.totals.aicQuantity)}</td>
                    <td className="cost-centers-view__num">{formatUsd(row.totals.aicNetAmount)}</td>
                    <td className={`cost-centers-view__num cost-centers-view__diff${diff > 0 ? '--positive' : diff < 0 ? '--negative' : ''}`}>
                      {formatDifference(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

          <div className="cost-centers-view__tableWrap data-table-wrap">
          <div className="cost-centers-view__tableTitle">Per user</div>
          <table className="cost-centers-view__table data-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="cost-centers-view__num">PRUs</th>
                <th className="cost-centers-view__num">PRU Cost</th>
                <th className="cost-centers-view__num">AICs</th>
                <th className="cost-centers-view__num">AIC Cost</th>
                <th className="cost-centers-view__num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => {
                const diff = calculateSavingsDifference(row.totals.netAmount, row.totals.aicNetAmount)
                return (
                  <tr key={row.username}>
                    <td className="cost-centers-view__name">{row.username}</td>
                    <td className="cost-centers-view__num">{row.totals.requests.toLocaleString()}</td>
                    <td className="cost-centers-view__num">{formatUsd(row.totals.netAmount)}</td>
                    <td className="cost-centers-view__num">{formatAic(row.totals.aicQuantity)}</td>
                    <td className="cost-centers-view__num">{formatUsd(row.totals.aicNetAmount)}</td>
                    <td className={`cost-centers-view__num cost-centers-view__diff${diff > 0 ? '--positive' : diff < 0 ? '--negative' : ''}`}>
                      {formatDifference(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
