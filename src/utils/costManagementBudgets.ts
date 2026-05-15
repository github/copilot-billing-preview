import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import type { UserSpendSegmentId } from './userSpendSegments'

export type BudgetField = 'user' | 'powerUser' | 'heavyUser' | 'account' | 'productCloudAgent' | 'productSpark' | 'productCopilot'

export type BudgetValues = Record<BudgetField, string>

export const EMPTY_BUDGET_VALUES: BudgetValues = {
  user: '',
  powerUser: '',
  heavyUser: '',
  account: '',
  productCloudAgent: '',
  productSpark: '',
  productCopilot: '',
}

function ceilAverageBudget(users: UserUsage[], selector: (user: UserUsage) => number): string {
  if (users.length === 0) return ''

  const average = users.reduce((sum, user) => sum + selector(user), 0) / users.length
  return String(Math.ceil(average))
}

export function getDefaultBudgetValues(users: UserUsage[]): BudgetValues {
  const powerUsers = users.filter((user) => user.spendSegment === 'power')
  const heavyUsers = users.filter((user) => user.spendSegment === 'heavy')
  const typicalUsers = users.filter((user) => user.spendSegment === 'typical')

  return {
    ...EMPTY_BUDGET_VALUES,
    user: ceilAverageBudget(typicalUsers, (user) => user.totals.aicGrossAmount),
    heavyUser: ceilAverageBudget(heavyUsers, (user) => user.totals.aicGrossAmount),
    powerUser: ceilAverageBudget(powerUsers, (user) => user.totals.aicGrossAmount),
  }
}

export function getUserSpendSegmentsByUsername(users: UserUsage[]): Record<string, UserSpendSegmentId> {
  return Object.fromEntries(users.map((user) => [user.username, user.spendSegment]))
}
