import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { CostCenterResult, CostCenterUserTotals, CostTotals } from '../pipeline/aggregators/costCenterAggregator'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { formatAic, formatDifference, formatUsd } from '../utils/format'

const MAX_DETAIL_ROWS = 20

type CostCenterRow = {
  label: string
  totals: {
    requests: number
    netAmount: number
    aicQuantity: number
    aicNetAmount: number
  }
}

function getTopRows(entries: [string, CostTotals | CostCenterUserTotals][]): CostCenterRow[] {
  return entries
    .map(([label, totals]) => ({ label, totals }))
    .sort((a, b) => Math.max(b.totals.netAmount, b.totals.aicNetAmount) - Math.max(a.totals.netAmount, a.totals.aicNetAmount))
    .slice(0, MAX_DETAIL_ROWS)
}

export function CostCentersView({ data, rangeStart }: { data: CostCenterResult; rangeStart?: string | null }) {
  const [selected, setSelected] = useState<string>(data.costCenters[0]?.costCenterName ?? '')
  const [activeTable, setActiveTable] = useState<'users' | 'models'>('users')

  const handleSelectChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelected(event.target.value)
  }, [])

  const costCenterDetails = useMemo(() => {
    return new Map(
      data.costCenters.map((costCenter) => [
        costCenter.costCenterName,
        {
          costCenter,
          modelRows: getTopRows(Object.entries(costCenter.totalsByModel)),
          userRows: getTopRows(Object.entries(costCenter.totalsByUser)),
        },
      ]),
    )
  }, [data.costCenters])

  const selectedCostCenterName = costCenterDetails.has(selected)
    ? selected
    : data.costCenters[0]?.costCenterName ?? ''

  const selectedDetails = costCenterDetails.get(selectedCostCenterName) ?? null
  const selectedCostCenter = selectedDetails?.costCenter ?? null
  const modelRows = selectedDetails?.modelRows ?? []
  const userRows = selectedDetails?.userRows ?? []

  const selectOptions = useMemo(() => {
    return data.costCenters.map((costCenter) => (
      <option key={costCenter.costCenterName} value={costCenter.costCenterName}>
        {costCenter.costCenterName}
      </option>
    ))
  }, [data.costCenters])

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
        <select className="cost-centers-view__select" value={selectedCostCenterName} onChange={handleSelectChange}>
          {selectOptions}
        </select>
      </div>

      {selectedCostCenter && totals && (
        <>
          {hasCosts && periodLabel && (
            <p className="comparison-framing">
              {savings > 0 ? (
                <>
                  <strong>{selectedCostCenterName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under AI Credits-based billing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{selectedCostCenterName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under AI Credits-based billing
                </>
              ) : (
                <>
                  <strong>{selectedCostCenterName}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under AI Credits-based billing
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
              <div className="comparison-card__label">AI Credits-based billing (AICs)</div>
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
            Under AI Credits-based billing, entitlements will be pooled across all licensed users in your organization. No more unused capacity going to waste from idle users.
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
        <div className="cost-centers-view__tableControls" aria-label="Cost center detail tables">
          <button
            type="button"
            className={`cost-centers-view__tableButton ${activeTable === 'users' ? 'cost-centers-view__tableButton--active' : ''}`}
            onClick={() => setActiveTable('users')}
            aria-pressed={activeTable === 'users'}
          >
            Top {MAX_DETAIL_ROWS} users
          </button>
          <button
            type="button"
            className={`cost-centers-view__tableButton ${activeTable === 'models' ? 'cost-centers-view__tableButton--active' : ''}`}
            onClick={() => setActiveTable('models')}
            aria-pressed={activeTable === 'models'}
          >
            Top {MAX_DETAIL_ROWS} models
          </button>
        </div>

        <div className="cost-centers-view__tableWrap data-table-wrap">
          <div className="cost-centers-view__tableTitle">
            {activeTable === 'users' ? `Per user (top ${MAX_DETAIL_ROWS})` : `Per model (top ${MAX_DETAIL_ROWS})`}
          </div>
          <div className="cost-centers-view__tableHint">
            Showing the highest-cost {activeTable === 'users' ? 'users' : 'models'} for <strong>{selectedCostCenterName}</strong>.
          </div>
          <table className="cost-centers-view__table data-table" key={`${selectedCostCenterName}-${activeTable}`}>
            <thead>
              <tr>
                <th>{activeTable === 'users' ? 'User' : 'Model'}</th>
                <th className="cost-centers-view__num">PRUs</th>
                <th className="cost-centers-view__num">PRU Cost</th>
                <th className="cost-centers-view__num">AICs</th>
                <th className="cost-centers-view__num">AIC Cost</th>
                <th className="cost-centers-view__num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {(activeTable === 'users' ? userRows : modelRows).map((row) => {
                const diff = calculateSavingsDifference(row.totals.netAmount, row.totals.aicNetAmount)
                return (
                  <tr key={row.label}>
                    <td className="cost-centers-view__name">{row.label}</td>
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
