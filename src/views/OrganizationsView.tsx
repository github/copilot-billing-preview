import { useCallback, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { BillingProjectionDisclaimer, NegotiatedDiscountDisclaimer } from '../components/ui'
import { th, thNum, td, tdNum } from '../components/ui/tableStyles'
import { appLinks } from '../config/links'
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
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="m-0 text-lg text-fg-default">Organizations</h2>
          <span className="text-[13px] text-fg-muted">0 total</span>
        </div>
        <div className="bg-bg-default border border-border-default rounded-md p-6 text-center text-fg-muted text-sm">No organizations found in this report.</div>
      </section>
    )
  }

  const totals = selectedOrg?.totals
  const aicDiscountAmount = totals ? calculateAicDiscountAmount(totals.aicGrossAmount, totals.aicNetAmount) : 0
  const savings = totals ? calculateSavingsDifference(totals.netAmount, totals.aicNetAmount) : 0
  const hasCosts = totals && (totals.grossAmount > 0 || totals.aicGrossAmount > 0)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="m-0 text-lg text-fg-default">Organizations</h2>
          <span className="text-[13px] text-fg-muted">
            {data.organizations.length.toLocaleString()} total
          </span>
        </div>
        <select className="border border-border-default rounded-md py-2.5 px-3 text-sm max-w-[500px] text-fg-default bg-bg-default focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2" value={selectedOrgName} onChange={handleSelectChange}>
          {selectOptions}
        </select>
      </div>

      {selectedOrg && totals && (
        <>
          {hasCosts && periodLabel && (
            <p className="text-base font-normal text-center mb-1 text-fg-default">
              {savings > 0 ? (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(savings)} less</strong> under usage-based billing
                </>
              ) : savings < 0 ? (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage would cost{' '}
                  <strong>{formatUsd(Math.abs(savings))} more</strong> under usage-based billing
                </>
              ) : (
                <>
                  <strong>{selectedOrgName}</strong>'s <strong>{periodLabel}</strong> usage cost would be the same under usage-based billing
                </>
              )}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div className="bg-bg-default border border-border-default rounded-md text-center py-7 px-5">
              <div className="text-[13px] font-medium text-fg-muted uppercase tracking-[0.5px] mb-3">Current billing (PRUs)</div>
              <div className="text-4xl font-bold leading-[1.2] text-fg-default">{formatUsd(totals.netAmount)}</div>
              <div className="text-sm text-fg-default mt-1.5">{totals.requests.toLocaleString()} PRUs</div>
              <div className="text-xs text-fg-muted mt-1">1 PRU = $0.04</div>
              <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>Consumed PRUs</span>
                  <span>{formatUsd(totals.grossAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                  <span>Included PRUs</span>
                  <span>−{formatUsd(totals.discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                  <span>Overages</span>
                  <span>{formatUsd(totals.netAmount)}</span>
                </div>
                <NegotiatedDiscountDisclaimer />
              </div>
            </div>
            <div className="bg-bg-default border border-border-default rounded-md text-center py-7 px-5">
              <div className="text-[13px] font-medium text-fg-muted uppercase tracking-[0.5px] mb-3">Usage-based billing (AICs)</div>
              <div className="text-4xl font-bold leading-[1.2] text-app-savings-fg">{formatUsd(totals.aicNetAmount)}</div>
              <div className="text-sm text-fg-default mt-1.5">{formatAic(totals.aicQuantity)} AICs</div>
              <div className="text-xs text-fg-muted mt-1">1 AIC = $0.01</div>
              <div className="mt-4 pt-3 border-t border-border-default w-full flex flex-col gap-1.5 text-left">
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums">
                  <span>Consumed AICs</span>
                  <span>{formatUsd(totals.aicGrossAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-muted tabular-nums">
                  <span>Included AICs</span>
                  <span>−{formatUsd(Math.abs(aicDiscountAmount))}</span>
                </div>
                <div className="flex justify-between items-center text-[13px] text-fg-default tabular-nums pt-1.5 border-t border-border-default font-semibold">
                  <span>Additional usage</span>
                  <span>{formatUsd(totals.aicNetAmount)}</span>
                </div>
                <NegotiatedDiscountDisclaimer />
              </div>
            </div>
          </div>
          <BillingProjectionDisclaimer className="mb-6" />
        </>
      )}

      <div className="bg-bg-default border border-border-default rounded-md py-5 px-6 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex-1 flex flex-col gap-1">
          <strong className="text-sm font-semibold text-fg-default">Pooled included credits are coming</strong>
          <p className="m-0 text-[13px] text-fg-muted leading-normal">
            Under usage-based billing, included credits will be pooled across all licensed users in your account (not per organization). Included credits are shared across your account-wide pool, not allocated separately to each organization. No more unused capacity going to waste from idle users.
          </p>
        </div>
        <a
          href={appLinks.aiCreditsForOrganizationsDocs}
          className="text-sm font-medium text-fg-accent no-underline whitespace-nowrap hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more &rarr;
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap border-b border-border-default" aria-label="Organization detail tables">
          <button
            type="button"
            className={`border-0 border-b-2 border-b-transparent -mb-px rounded-none bg-transparent text-fg-muted px-4 py-2 text-sm font-normal cursor-pointer transition-[color,border-color] duration-100 ease-in-out hover:text-fg-default focus-visible:outline-2 focus-visible:outline-fg-accent focus-visible:outline-offset-[-2px] focus-visible:rounded-sm ${activeTable === 'users' ? '!text-fg-default !font-semibold !border-b-fg-accent' : ''}`}
            onClick={() => setActiveTable('users')}
            aria-pressed={activeTable === 'users'}
          >
            Top {MAX_DETAIL_ROWS} users
          </button>
          <button
            type="button"
            className={`border-0 border-b-2 border-b-transparent -mb-px rounded-none bg-transparent text-fg-muted px-4 py-2 text-sm font-normal cursor-pointer transition-[color,border-color] duration-100 ease-in-out hover:text-fg-default focus-visible:outline-2 focus-visible:outline-fg-accent focus-visible:outline-offset-[-2px] focus-visible:rounded-sm ${activeTable === 'models' ? '!text-fg-default !font-semibold !border-b-fg-accent' : ''}`}
            onClick={() => setActiveTable('models')}
            aria-pressed={activeTable === 'models'}
          >
            Top {MAX_DETAIL_ROWS} models
          </button>
        </div>

        <div className="bg-bg-default border border-border-default rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default text-xs font-bold tracking-[0.05em] uppercase text-fg-muted bg-bg-muted">
            {activeTable === 'users' ? `Per user (top ${MAX_DETAIL_ROWS})` : `Per model (top ${MAX_DETAIL_ROWS})`}
          </div>
          <div className="px-4 pt-3 text-[13px] text-fg-muted">
            Showing the top {MAX_DETAIL_ROWS} {activeTable === 'users' ? 'users' : 'models'} by AI Credits consumed for <strong>{selectedOrgName}</strong>.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" key={`${selectedOrgName}-${activeTable}`}>
              <thead>
                <tr>
                  <th className={th}>{activeTable === 'users' ? 'User' : 'Model'}</th>
                  <th className={thNum}>PRUs</th>
                  <th className={thNum}>PRU Cost</th>
                  <th className={thNum}>AICs</th>
                  <th className={thNum}>AIC Cost</th>
                  <th className={thNum}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {(activeTable === 'users' ? userRows : modelRows).map((row) => {
                  const diff = calculateSavingsDifference(row.totals.netAmount, row.totals.aicNetAmount)
                  return (
                    <tr key={row.label}>
                      <td className={`${td} font-semibold text-fg-default`}>{row.label}</td>
                      <td className={tdNum}>{row.totals.requests.toLocaleString()}</td>
                      <td className={tdNum}>{formatUsd(row.totals.netAmount)}</td>
                      <td className={tdNum}>{formatAic(row.totals.aicQuantity)}</td>
                      <td className={tdNum}>{formatUsd(row.totals.aicNetAmount)}</td>
                      <td className={`${tdNum}${diff > 0 ? ' text-app-savings-fg font-semibold' : diff < 0 ? ' text-fg-danger font-semibold' : ''}`}>
                        {formatDifference(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
