import { useMemo } from 'react'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { calculateUserSpendInsights } from '../utils/userSpendSegments'
import { th, thNum, td, tdNum } from '../components/ui/tableStyles'
import { formatUsd } from '../utils/format'

export interface SpendInsightsViewProps {
  users: UserUsage[]
  onSelectUser?: (username: string) => void
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'

  const percent = value * 100
  return percent < 10 ? `${percent.toFixed(1)}%` : `${percent.toFixed(0)}%`
}

function formatUserCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'user' : 'users'}`
}

export function SpendInsightsView({ users, onSelectUser }: SpendInsightsViewProps) {
  const insights = useMemo(() => calculateUserSpendInsights(users), [users])
  const powerSegment = insights.segments.find((segment) => segment.id === 'power')
  const typicalSegment = insights.segments.find((segment) => segment.id === 'typical')
  const topUserAicGrossAmount = insights.topUsers[0]?.aicGrossAmount ?? 0
  const topUsersAicGrossAmount = insights.topUsers.reduce((sum, user) => sum + user.aicGrossAmount, 0)
  const top10PercentAicGrossAmount = insights.totalAicGrossAmount * insights.top10PercentShare
  const hasAicGrossCost = insights.totalAicGrossAmount > 0 && insights.top10PercentUserCount > 0
  const top10PercentUserLabel = formatUserCount(insights.top10PercentUserCount)

  return (
    <section className="flex flex-col gap-5" aria-labelledby="spend-insights-title">
      <div className="flex flex-col gap-2">
        <h2 id="spend-insights-title" className="m-0 text-lg text-fg-default">Spend Insights</h2>
        <p className="m-0 text-sm text-fg-muted leading-normal">
          {hasAicGrossCost ? (
            <>
              The top <strong className="text-fg-default">10%</strong> of users (<strong className="text-fg-default">{top10PercentUserLabel}</strong>) account for{' '}
              <strong className="text-fg-default">{formatPercent(insights.top10PercentShare)}</strong> of AIC gross cost.
            </>
          ) : (
            insights.concentrationHeadline
          )}
          {powerSegment && typicalSegment && powerSegment.userCount > 0 && typicalSegment.userCount > 0 && (
            <>
              {' '}Power users average <strong className="text-fg-default">{formatUsd(powerSegment.averageAicGrossAmount)}</strong> in AIC gross cost per user, compared with{' '}
              <strong className="text-fg-default">{formatUsd(typicalSegment.averageAicGrossAmount)}</strong> for typical users.
            </>
          )}
        </p>
      </div>

      <div className="bg-bg-default border border-border-default rounded-md overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={th}>Concentration metric</th>
              <th className={thNum}>Users</th>
              <th className={thNum}>Share of AIC Gross</th>
              <th className={thNum}>AIC Gross</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${td} font-semibold text-fg-default`}>Top user</td>
              <td className={tdNum}>{formatUserCount(insights.topUsers.length > 0 ? 1 : 0)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatPercent(insights.topUserShare)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatUsd(topUserAicGrossAmount)}</td>
            </tr>
            <tr>
              <td className={`${td} font-semibold text-fg-default`}>Top 5 users</td>
              <td className={tdNum}>{formatUserCount(insights.topUsers.length)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatPercent(insights.topUsersShare)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatUsd(topUsersAicGrossAmount)}</td>
            </tr>
            <tr>
              <td className={`${td} font-semibold text-fg-default`}>Top 10%</td>
              <td className={tdNum}>{formatUserCount(insights.top10PercentUserCount)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatPercent(insights.top10PercentShare)}</td>
              <td className={`${tdNum} font-semibold text-fg-default`}>{formatUsd(top10PercentAicGrossAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4">
        <div className="border border-border-default rounded-md p-4 bg-bg-default">
          <h3 className="m-0 text-sm font-semibold text-fg-default">Top spend drivers</h3>
          <p className="m-0 mt-1 text-xs text-fg-muted">Users ranked by AIC gross cost.</p>
          {insights.topUsers.length > 0 ? (
            <div className="mt-3 -mx-4 -mb-4 overflow-auto">
              <table className="w-full border-collapse text-[13px]">
                <colgroup>
                  <col className="w-[72px]" />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className={th}>Rank</th>
                    <th className={th}>User</th>
                    <th className={thNum}>AIC Gross</th>
                    <th className={thNum}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.topUsers.map((user, index) => (
                    <tr key={user.username}>
                      <td className={td}>{index + 1}</td>
                      <td className={`${td} font-semibold text-fg-default`}>
                        {onSelectUser ? (
                          <button
                            type="button"
                            className="border-0 bg-transparent p-0 text-left text-fg-accent font-semibold cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 rounded-sm"
                            onClick={() => onSelectUser(user.username)}
                          >
                            {user.username}
                          </button>
                        ) : (
                          user.username
                        )}
                      </td>
                      <td className={`${tdNum} font-semibold text-fg-default`}>{formatUsd(user.aicGrossAmount)}</td>
                      <td className={tdNum}>{formatPercent(user.shareOfTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 mt-3 text-[13px] text-fg-muted">No users have AIC gross cost in this report.</p>
          )}
        </div>

        <div className="border border-border-default rounded-md p-4 bg-bg-default">
          <h3 className="m-0 text-sm font-semibold text-fg-default">Spending by group</h3>
          <p className="m-0 mt-1 text-xs text-fg-muted">Percentile segments based on AIC gross cost.</p>
          <div className="mt-3 -mx-4 -mb-4 overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Group</th>
                  <th className={thNum}>Users</th>
                  <th className={thNum}>AIC Gross</th>
                  <th className={thNum}>Share</th>
                  <th className={thNum}>Avg/user</th>
                  <th className={thNum}>Median/user</th>
                </tr>
              </thead>
              <tbody>
                {insights.segments.map((segment) => (
                  <tr key={segment.id}>
                    <td className={`${td} font-semibold text-fg-default`}>
                      <span className="block">{segment.label}</span>
                      <span className="block text-xs font-normal text-fg-muted">{segment.description}</span>
                    </td>
                    <td className={tdNum}>{formatUserCount(segment.userCount)}</td>
                    <td className={`${tdNum} font-semibold text-fg-default`}>{formatUsd(segment.totalAicGrossAmount)}</td>
                    <td className={tdNum}>{formatPercent(segment.shareOfTotal)}</td>
                    <td className={tdNum}>{formatUsd(segment.averageAicGrossAmount)}</td>
                    <td className={tdNum}>{formatUsd(segment.medianAicGrossAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
