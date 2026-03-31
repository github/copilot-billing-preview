import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { getMonthlyAicEntitlements } from '../pipeline/aicEntitlements'
import { formatAic } from '../utils/format'
import { Trie } from '../utils/trie'

function formatInt(n: number): string {
  return n.toLocaleString()
}

function formatCost(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface UsersViewProps {
  users: UserUsage[]
  onSelectUser?: (username: string) => void
}

export function UsersView({ users, onSelectUser }: UsersViewProps) {
  const [query, setQuery] = useState('')

  const licenseSummary = useMemo(() => {
    const summary = [
      { label: 'Copilot Business', users: 0, includedAic: 0 },
      { label: 'Copilot Enterprise', users: 0, includedAic: 0 },
    ]

    users.forEach((user) => {
      const includedAic = getMonthlyAicEntitlements(user.totalMonthlyQuota)

      if (includedAic === 3000) {
        summary[0].users += 1
        summary[0].includedAic += includedAic
      }

      if (includedAic === 7000) {
        summary[1].users += 1
        summary[1].includedAic += includedAic
      }
    })

    const totalUsers = summary.reduce((sum, row) => sum + row.users, 0)
    const totalIncludedAic = summary.reduce((sum, row) => sum + row.includedAic, 0)

    return {
      rows: summary,
      totalUsers,
      totalIncludedAic,
    }
  }, [users])

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.username.localeCompare(b.username))
  }, [users])

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

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  return (
    <section className="users-view">
      <div className="users-view__title">
        <h2 className="users-view__heading">Users</h2>
        <span className="users-view__count">{filteredUsers.length.toLocaleString()} shown</span>
      </div>
      <div className="users-view__summaryWrap data-table-wrap">
        <table className="users-view__summaryTable data-table">
          <thead>
            <tr>
              <th>License type</th>
              <th className="users-view__num">Users</th>
              <th className="users-view__num">Included AICs</th>
            </tr>
          </thead>
          <tbody>
            {licenseSummary.rows.map((row) => (
              <tr key={row.label}>
                <td className="users-view__license">{row.label}</td>
                <td className="users-view__num">{formatInt(row.users)}</td>
                <td className="users-view__num">{formatAic(row.includedAic)}</td>
              </tr>
            ))}
            <tr>
              <td className="users-view__license users-view__license--total">Total AIC pool</td>
              <td className="users-view__num users-view__num--total">{formatInt(licenseSummary.totalUsers)}</td>
              <td className="users-view__num users-view__num--total">{formatAic(licenseSummary.totalIncludedAic)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <input
        className="users-view__search"
        placeholder="Search users (prefix)…"
        value={query}
        onChange={onChange}
        aria-label="Search users"
      />

      <div className="users-view__tableWrap data-table-wrap">
        <table className="users-view__table data-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="users-view__num">Requests</th>
              <th className="users-view__num">AI Credits</th>
              <th className="users-view__num">Models</th>
              <th className="users-view__num">Gross Cost</th>
              <th className="users-view__num">Discounts</th>
              <th className="users-view__num">Net Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.username}
                className={onSelectUser ? 'users-view__row users-view__row--clickable' : 'users-view__row'}
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
                <td className="users-view__user">{user.username}</td>
                <td className="users-view__num">{formatInt(user.totals.requests)}</td>
                <td className="users-view__num">{formatAic(user.totals.aicQuantity)}</td>
                <td className="users-view__num">{formatInt(user.totals.distinctModels)}</td>
                <td className="users-view__num">{formatCost(user.totals.grossAmount)}</td>
                <td className="users-view__num">{formatCost(user.totals.discountAmount)}</td>
                <td className="users-view__num">{formatCost(user.totals.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
