import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { OrganizationResult, OrgTotals, OrgUserTotals } from '../pipeline/aggregators/organizationAggregator'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../utils/billingComparison'
import { formatAic, formatDifference, formatUsd } from '../utils/format'

const MAX_DETAIL_ROWS = 20

type OrgRow = {
  label: string
  totals: {
    requests: number
    netAmount: number
    aicQuantity: number
    aicNetAmount: number
  }
}

function getTopRows(entries: [string, OrgTotals | OrgUserTotals][]): OrgRow[] {
  return entries
    .map(([label, totals]) => ({ label, totals }))
    .sort((a, b) => {
      if (b.totals.aicQuantity !== a.totals.aicQuantity) {
        return b.totals.aicQuantity - a.totals.aicQuantity
      }
      return a.label.localeCompare(b.label)
    })
}

export function OrganizationsView({ data, rangeStart }: { data: OrganizationResult; rangeStart?: string | null }) {
  const [selected, setSelected] = useState<string>(data.organizations[0]?.organization ?? '')
  const [activeTable, setActiveTable] = useState<'users' | 'models'>('users')

  const handleSelectChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelected(event.target.value)
  }, [])

  const orgDetails = useMemo(() => {
    return new Map(
      data.organizations.map((org) => [
        org.organization,
        {
          org,
          modelRows: getTopRows(Object.entries(org.totalsByModel)),
          userRows: getTopRows(Object.entries(org.totalsByUser)),
        },
      ]),
    )
  }, [data.organizations])

  const selectedOrgName = orgDetails.has(selected)
    ? selected
    : data.organizations[0]?.organization ?? ''

  const selectedDetails = orgDetails.get(selectedOrgName) ?? null
  const selectedOrg = selectedDetails?.org ?? null
  const modelRows = selectedDetails?.modelRows ?? []
  const userRows = selectedDetails?.userRows ?? []

  const selectOptions = useMemo(() => {
    return data.organizations.map((org) => (
      <option key={org.organization} value={org.organization}>
        {org.organization}
      </option>
    ))
  }, [data.organizations])

  const periodLabel = rangeStart
    ? new Date(rangeStart + 'T00:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : null

  if (data.organizations.length === 0) {
    return (
      <section className="orgs-view">
        <h2 className="orgs-view__heading">Organizations</h2>
        <div className="orgs-view__empty">No organizations found in this report.</div>
      </section>
    )
  }

  const totals = selectedOrg?.totals
  const aicDiscountAmount = totals ? calculateAicDiscountAmount(totals.aicGrossAmount, totals.aicNetAmount) : 0
  const savings = totals ? calculateSavingsDifference(totals.netAmount, totals.aicNetAmount) : 0
  const hasCosts = totals && (totals.grossAmount > 0 || totals.aicGrossAmount > 0)

  return (
    <section className="orgs-view">
      <div className="orgs-view__header">
        <div className="orgs-view__title">
          <h2 className="orgs-view__heading">Organizations</h2>
          <span className="orgs-view__count">{data.organizations.length.toLocaleString()} total</span>
        </div>
        <select className="orgs-view__select" value={selectedOrgName} onChange={handleSelectChange}>
          {selectOptions}
        </select>
      </div>

      {selectedOrg && totals && (
        <>
          {hasCosts && periodLabel && (
            <p className="comparison-framing">
              {savings > 0 ? (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under AI Credits-based billing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under AI Credits-based billing
                </>
              ) : (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under AI Credits-based billing
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

      <div className="orgs-view__tables">
        <div className="orgs-view__tableControls" aria-label="Organization detail tables">
          <button
            type="button"
            className={`orgs-view__tableButton ${activeTable === 'users' ? 'orgs-view__tableButton--active' : ''}`}
            onClick={() => setActiveTable('users')}
            aria-pressed={activeTable === 'users'}
          >
            Top {MAX_DETAIL_ROWS} users
          </button>
          <button
            type="button"
            className={`orgs-view__tableButton ${activeTable === 'models' ? 'orgs-view__tableButton--active' : ''}`}
            onClick={() => setActiveTable('models')}
            aria-pressed={activeTable === 'models'}
          >
            Top {MAX_DETAIL_ROWS} models
          </button>
        </div>

        <div className="orgs-view__tableWrap data-table-wrap">
          <div className="orgs-view__tableTitle">
            {activeTable === 'users' ? `Per user (top ${MAX_DETAIL_ROWS})` : `Per model (top ${MAX_DETAIL_ROWS})`}
          </div>
          <div className="orgs-view__tableHint">
            Showing the top {MAX_DETAIL_ROWS} {activeTable === 'users' ? 'users' : 'models'} by AI Credits consumed for <strong>{selectedOrgName}</strong>.
          </div>
          <table className="orgs-view__table data-table" key={`${selectedOrgName}-${activeTable}`}>
            <thead>
              <tr>
                <th>{activeTable === 'users' ? 'User' : 'Model'}</th>
                <th className="orgs-view__num">PRUs</th>
                <th className="orgs-view__num">PRU Cost</th>
                <th className="orgs-view__num">AICs</th>
                <th className="orgs-view__num">AIC Cost</th>
                <th className="orgs-view__num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {(activeTable === 'users' ? userRows : modelRows).map((row) => {
                const diff = calculateSavingsDifference(row.totals.netAmount, row.totals.aicNetAmount)
                return (
                  <tr key={row.label}>
                    <td className="orgs-view__name">{row.label}</td>
                    <td className="orgs-view__num">{row.totals.requests.toLocaleString()}</td>
                    <td className="orgs-view__num">{formatUsd(row.totals.netAmount)}</td>
                    <td className="orgs-view__num">{formatAic(row.totals.aicQuantity)}</td>
                    <td className="orgs-view__num">{formatUsd(row.totals.aicNetAmount)}</td>
                    <td className={`orgs-view__num orgs-view__diff${diff > 0 ? '--positive' : diff < 0 ? '--negative' : ''}`}>
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

