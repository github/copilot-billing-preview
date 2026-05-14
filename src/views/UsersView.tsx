import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import {
  type AicIncludedCreditsOverrides,
  BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS,
  ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
  calculateLicenseSummary,
  inferReportPlanScope,
} from '../pipeline/aicIncludedCredits'
import { calculateSavingsDifference } from '../utils/billingComparison'
import { InfoTip } from '../components/InfoTip'
import { formatAic, formatDifference } from '../utils/format'
import { Trie } from '../utils/trie'
import { th, thBase, thNum, td, tdNum, sortBtn } from '../components/ui/tableStyles'

const PAGE_SIZE = 50

function formatInt(n: number): string {
  return n.toLocaleString()
}

function formatCost(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type SeatOverrides = AicIncludedCreditsOverrides

type SortKey = 'username' | 'requests' | 'aicQuantity' | 'distinctModels' | 'netAmount' | 'aicNetAmount' | 'difference'
type SortDir = 'asc' | 'desc'

function getSortValue(user: UserUsage, key: SortKey): number | string {
  switch (key) {
    case 'username': return user.username.toLowerCase()
    case 'requests': return user.totals.requests
    case 'aicQuantity': return user.totals.aicQuantity
    case 'distinctModels': return user.totals.distinctModels
    case 'netAmount': return user.totals.netAmount
    case 'aicNetAmount': return user.totals.aicNetAmount
    case 'difference': return user.totals.netAmount - user.totals.aicNetAmount
  }
}

export interface UsersViewProps {
  users: UserUsage[]
  seatOverrides?: SeatOverrides
  onSeatOverridesChange?: (overrides: SeatOverrides) => void
  onSelectUser?: (username: string) => void
}

export function UsersView({ users, seatOverrides = {}, onSeatOverridesChange, onSelectUser }: UsersViewProps) {
  const [query, setQuery] = useState('')
  const [pageAnchor, setPageAnchor] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('aicQuantity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const licenseSummary = useMemo(() => calculateLicenseSummary(users), [users])
  const reportPlanScope = useMemo(
    () => inferReportPlanScope(users.length, users.some((user) => user.organizations.length > 0 || user.costCenters.length > 0)),
    [users],
  )

  const defaultBusiness = licenseSummary.rows.find((r) => r.label === 'Copilot Business')?.users ?? 0
  const defaultEnterprise = licenseSummary.rows.find((r) => r.label === 'Copilot Enterprise')?.users ?? 0

  const [draftBusiness, setDraftBusiness] = useState<string>('')
  const [draftEnterprise, setDraftEnterprise] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)

  const savedBusiness = seatOverrides.business ?? defaultBusiness
  const savedEnterprise = seatOverrides.enterprise ?? defaultEnterprise
  const hasSavedOverride = seatOverrides.business !== undefined || seatOverrides.enterprise !== undefined

  const displayBusiness = isEditing ? (draftBusiness !== '' ? parseInt(draftBusiness, 10) || 0 : savedBusiness) : savedBusiness
  const displayEnterprise = isEditing ? (draftEnterprise !== '' ? parseInt(draftEnterprise, 10) || 0 : savedEnterprise) : savedEnterprise

  const adjustedSummary = useMemo(() => {
    if (reportPlanScope === 'individual') return licenseSummary
    const bAic = displayBusiness * BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS
    const eAic = displayEnterprise * ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS
    return {
      rows: [
        { label: 'Copilot Business', users: displayBusiness, includedAic: bAic },
        { label: 'Copilot Enterprise', users: displayEnterprise, includedAic: eAic },
      ],
      totalUsers: displayBusiness + displayEnterprise,
      totalIncludedAic: bAic + eAic,
    }
  }, [licenseSummary, displayBusiness, displayEnterprise, reportPlanScope])

  const handleEdit = () => {
    setDraftBusiness(String(savedBusiness))
    setDraftEnterprise(String(savedEnterprise))
    setIsEditing(true)
  }

  const handleSave = () => {
    const parsedBusiness = Number(draftBusiness)
    const parsedEnterprise = Number(draftEnterprise)
    const normalizedBusiness = Number.isFinite(parsedBusiness)
      ? Math.max(defaultBusiness, Math.floor(parsedBusiness))
      : defaultBusiness
    const normalizedEnterprise = Number.isFinite(parsedEnterprise)
      ? Math.max(defaultEnterprise, Math.floor(parsedEnterprise))
      : defaultEnterprise
    const newOverrides: SeatOverrides = {}
    if (normalizedBusiness !== defaultBusiness) newOverrides.business = normalizedBusiness
    if (normalizedEnterprise !== defaultEnterprise) newOverrides.enterprise = normalizedEnterprise
    onSeatOverridesChange?.(newOverrides)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraftBusiness('')
    setDraftEnterprise('')
    setIsEditing(false)
  }

  const handleReset = () => {
    onSeatOverridesChange?.({})
    setIsEditing(false)
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'username' ? 'asc' : 'desc')
    }
    setPageAnchor(null)
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)
      let cmp: number
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal)
      } else {
        cmp = (aVal as number) - (bVal as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [users, sortKey, sortDir])

  const trie = useMemo(() => {
    const nextTrie = new Trie()
    sortedUsers.forEach((user, index) => nextTrie.insert(user.username.toLowerCase(), index))
    return nextTrie
  }, [sortedUsers])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return sortedUsers

    const indices = trie.searchPrefix(normalizedQuery)
    return indices.map((index) => sortedUsers[index])
  }, [query, sortedUsers, trie])

  const anchoredIndex = pageAnchor
    ? filteredUsers.findIndex((user) => user.username === pageAnchor)
    : 0
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = anchoredIndex >= 0
    ? Math.floor(anchoredIndex / PAGE_SIZE)
    : 0
  const pageStart = safePage * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredUsers.length)
  const pageUsers = filteredUsers.slice(pageStart, pageEnd)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
    setPageAnchor(null)
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const getAriaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="m-0 text-lg text-fg-default">Users</h2>
        <span className="text-[13px] text-fg-muted">
          {filteredUsers.length.toLocaleString()} with activity
          <InfoTip text="Only users who generated at least one premium request during this report period are shown. This may be fewer than your total licensed seats. You can edit the user counts in the table below to estimate the full included credit pool." />
        </span>
      </div>
      <div className="bg-bg-default border border-border-default rounded-md overflow-auto mb-4 p-4">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={th}>License type</th>
              <th className={thNum}>Users</th>
              <th className={thNum}>Included AICs</th>
            </tr>
          </thead>
          <tbody>
            {reportPlanScope === 'organization' ? (
              <>
                <tr>
                  <td className={`${td} font-medium text-fg-default`}>Copilot Business</td>
                  <td className={tdNum}>
                    {isEditing ? (
                      <input
                        className="w-[90px] px-1.5 py-0.5 text-[13px] tabular-nums text-right border border-border-default rounded-sm bg-bg-default focus:outline-none focus:border-fg-accent focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]"
                        type="number"
                        min={defaultBusiness}
                        step="1"
                        value={draftBusiness}
                        onChange={(e) => setDraftBusiness(e.target.value)}
                        aria-label="Copilot Business user count"
                      />
                    ) : (
                      <span className={hasSavedOverride && seatOverrides.business !== undefined ? 'text-fg-accent font-semibold' : ''}>
                        {formatInt(savedBusiness)}
                      </span>
                    )}
                  </td>
                  <td className={tdNum}>{formatAic(adjustedSummary.rows[0].includedAic)}</td>
                </tr>
                <tr>
                  <td className={`${td} font-medium text-fg-default`}>Copilot Enterprise</td>
                  <td className={tdNum}>
                    {isEditing ? (
                      <input
                        className="w-[90px] px-1.5 py-0.5 text-[13px] tabular-nums text-right border border-border-default rounded-sm bg-bg-default focus:outline-none focus:border-fg-accent focus:shadow-[0_0_0_3px_rgba(9,105,218,0.3)]"
                        type="number"
                        min={defaultEnterprise}
                        step="1"
                        value={draftEnterprise}
                        onChange={(e) => setDraftEnterprise(e.target.value)}
                        aria-label="Copilot Enterprise user count"
                      />
                    ) : (
                      <span className={hasSavedOverride && seatOverrides.enterprise !== undefined ? 'text-fg-accent font-semibold' : ''}>
                        {formatInt(savedEnterprise)}
                      </span>
                    )}
                  </td>
                  <td className={tdNum}>{formatAic(adjustedSummary.rows[1].includedAic)}</td>
                </tr>
              </>
            ) : (
              licenseSummary.rows.map((row) => (
                <tr key={row.label}>
                  <td className={`${td} font-medium text-fg-default`}>{row.label}</td>
                  <td className={tdNum}>{formatInt(row.users)}</td>
                  <td className={tdNum}>{formatAic(row.includedAic)}</td>
                </tr>
              ))
            )}
            <tr>
              <td className={`${td} font-semibold text-fg-default`}>
                {reportPlanScope === 'individual' ? 'Total included AICs' : 'Total AIC pool'}
              </td>
              <td className={`${tdNum} font-semibold`}>{formatInt(adjustedSummary.totalUsers)}</td>
              <td className={`${tdNum} font-semibold`}>{formatAic(adjustedSummary.totalIncludedAic)}</td>
            </tr>
          </tbody>
        </table>
        <div className="text-xs text-fg-muted mt-3 px-1 space-y-2">
          <p>
            Users without activity in the reporting period may not be present in the report.
            <br />
            You can <strong>add</strong> missing Copilot Business and Copilot Enterprise licenses (but not remove or reduce historical numbers in this report) for accurate bill estimation.
          </p>
          {displayBusiness > 0 && (
            <p>
              Upgrading Copilot Business users to Copilot Enterprise during the promotional period reduces the additional usage cost by <strong>$20</strong> per upgrade.
            </p>
          )}
        </div>
        {reportPlanScope === 'organization' && (
          <div className="flex gap-2 mt-3 px-1">
            {isEditing ? (
              <>
                <button type="button" className="px-4 py-1.5 text-[13px] font-medium border border-transparent rounded-md bg-bg-success-emphasis text-fg-on-emphasis cursor-pointer hover:opacity-90" onClick={handleSave}>Save</button>
                <button type="button" className="px-4 py-1.5 text-[13px] font-medium border border-border-default rounded-md bg-bg-muted text-fg-default cursor-pointer hover:bg-bg-inset" onClick={handleCancel}>Cancel</button>
              </>
            ) : (
              <>
                <button type="button" className="px-4 py-1.5 text-[13px] font-medium border border-border-default rounded-md bg-bg-muted text-fg-default cursor-pointer hover:bg-bg-inset" onClick={handleEdit}>Edit seat counts</button>
                {hasSavedOverride && (
                  <button type="button" className="px-4 py-1.5 text-[13px] font-medium border border-transparent rounded-md bg-transparent text-fg-muted cursor-pointer hover:bg-bg-muted hover:text-fg-default" onClick={handleReset}>Reset to report values</button>
                )}
              </>
            )}
          </div>
        )}
        {hasSavedOverride && !isEditing && (
          <p className="text-xs text-fg-muted mt-3 px-1 italic">
            Seat counts have been adjusted. AI Credits-based totals across the report now reflect your edited seat counts.
          </p>
        )}
      </div>

      <input
        className="border border-border-default rounded-md px-3 py-2.5 text-sm max-w-[260px] w-full mb-4 focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2"
        placeholder="Search users (prefix)…"
        value={query}
        onChange={onChange}
        aria-label="Search users"
      />

      <div className="bg-bg-default border border-border-default rounded-md overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={`${thBase} text-left select-none`} aria-sort={getAriaSort('username')}>
                <button type="button" className={`${sortBtn} justify-start`} onClick={() => handleSort('username')}>
                  <span>User</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('username')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('requests')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('requests')}>
                  <span>PRUs</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('requests')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('aicQuantity')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('aicQuantity')}>
                  <span>AICs</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('aicQuantity')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('distinctModels')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('distinctModels')}>
                  <span>Models used</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('distinctModels')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('netAmount')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('netAmount')}>
                  <span>PRU Net Cost</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('netAmount')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('aicNetAmount')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('aicNetAmount')}>
                  <span>AIC Net Cost</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('aicNetAmount')}</span>
                </button>
              </th>
              <th className={`${thBase} text-right select-none`} aria-sort={getAriaSort('difference')}>
                <button type="button" className={`${sortBtn} justify-end`} onClick={() => handleSort('difference')}>
                  <span>Difference</span>
                  <span className="min-w-[2ch]" aria-hidden="true">{sortIndicator('difference')}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user) => {
              const diff = calculateSavingsDifference(user.totals.netAmount, user.totals.aicNetAmount)
              return (
                <tr
                  key={user.username}
                  className={onSelectUser ? 'cursor-pointer [&:hover>td]:bg-bg-muted focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-[-2px]' : undefined}
                  onClick={onSelectUser ? () => onSelectUser(user.username) : undefined}
                  onKeyDown={
                    onSelectUser
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelectUser(user.username)
                          }
                        }
                      : undefined
                  }
                  role={onSelectUser ? 'button' : undefined}
                  tabIndex={onSelectUser ? 0 : undefined}
                >
                  <td className={`${td} font-semibold text-fg-default`}>{user.username}</td>
                  <td className={tdNum}>{formatInt(user.totals.requests)}</td>
                  <td className={tdNum}>{formatAic(user.totals.aicQuantity)}</td>
                  <td className={tdNum}>{formatInt(user.totals.distinctModels)}</td>
                  <td className={tdNum}>{formatCost(user.totals.netAmount)}</td>
                  <td className={tdNum}>{formatCost(user.totals.aicNetAmount)}</td>
                  <td className={`${tdNum} font-semibold ${diff > 0 ? 'text-app-savings-fg' : diff < 0 ? 'text-app-overspend-fg' : 'text-fg-muted'}`}>
                    {formatDifference(diff)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-3">
          <button
            className="border border-border-default rounded-md bg-bg-default text-fg-default px-3.5 py-1.5 font-[inherit] text-sm cursor-pointer transition-colors hover:not-disabled:bg-bg-muted hover:not-disabled:border-border-emphasis disabled:opacity-40 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-fg-accent focus-visible:outline-offset-2"
            onClick={() => setPageAnchor(filteredUsers[Math.max(0, safePage - 1) * PAGE_SIZE]?.username ?? null)}
            disabled={safePage === 0}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <span className="text-[13px] text-fg-muted tabular-nums min-w-[140px] text-center">
            {(pageStart + 1).toLocaleString()}–{pageEnd.toLocaleString()} of {filteredUsers.length.toLocaleString()}
          </span>
          <button
            className="border border-border-default rounded-md bg-bg-default text-fg-default px-3.5 py-1.5 font-[inherit] text-sm cursor-pointer transition-colors hover:not-disabled:bg-bg-muted hover:not-disabled:border-border-emphasis disabled:opacity-40 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-fg-accent focus-visible:outline-offset-2"
            onClick={() => setPageAnchor(filteredUsers[Math.min(totalPages - 1, safePage + 1) * PAGE_SIZE]?.username ?? null)}
            disabled={safePage === totalPages - 1}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  )
}
