import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { Trie } from '../utils/trie'

function formatInt(n: number): string {
  return n.toLocaleString()
}

function formatCost(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function UsersView({ users }: { users: UserUsage[] }) {
  const [query, setQuery] = useState('')

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.username.localeCompare(b.username))
  }, [users])

  const trie = useMemo(() => {
    const t = new Trie()
    sortedUsers.forEach((u, idx) => t.insert(u.username.toLowerCase(), idx))
    return t
  }, [sortedUsers])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedUsers

    const indices = trie.searchPrefix(q)
    return indices.map((i) => sortedUsers[i])
  }, [query, sortedUsers, trie])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  return (
    <section className="users-view">
      <div className="users-view__toolbar">
        <div className="users-view__title">
          <h2 className="users-view__heading">Users</h2>
          <span className="users-view__count">{filteredUsers.length.toLocaleString()} shown</span>
        </div>
        <input
          className="users-view__search"
          placeholder="Search users (prefix)…"
          value={query}
          onChange={onChange}
          aria-label="Search users"
        />
      </div>

      <div className="users-view__tableWrap">
        <table className="users-view__table">
          <thead>
            <tr>
              <th>User</th>
              <th className="users-view__num">Requests</th>
              <th className="users-view__num">Input</th>
              <th className="users-view__num">Output</th>
              <th className="users-view__num">Cache Create</th>
              <th className="users-view__num">Cache Read</th>
              <th className="users-view__num">Total Tokens</th>
              <th className="users-view__num">Models</th>
              <th className="users-view__num">Net Cost</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.username}>
                <td className="users-view__user">{u.username}</td>
                <td className="users-view__num">{formatInt(u.totals.requests)}</td>
                <td className="users-view__num">{formatInt(u.totals.inputTokens)}</td>
                <td className="users-view__num">{formatInt(u.totals.outputTokens)}</td>
                <td className="users-view__num">{formatInt(u.totals.cacheCreationTokens)}</td>
                <td className="users-view__num">{formatInt(u.totals.cacheReadTokens)}</td>
                <td className="users-view__num">{formatInt(u.totals.totalTokens)}</td>
                <td className="users-view__num">{formatInt(u.totals.distinctModels)}</td>
                <td className="users-view__num">{formatCost(u.totals.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
