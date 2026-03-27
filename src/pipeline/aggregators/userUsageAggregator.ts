import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'

export type UserModelDailyUsage = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
  aiuGrossAmount: number
  aicNetAmount: number
}

export type UserDailyUsage = {
  date: string
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
  aiuGrossAmount: number
  aicNetAmount: number
  models: Record<string, UserModelDailyUsage>
}

export type UserUsage = {
  username: string
  totalMonthlyQuota: number
  organizations: string[]
  costCenters: string[]
  daily: Record<string, UserDailyUsage>
  totals: Omit<UserDailyUsage, 'date' | 'models'> & {
    distinctModels: number
  }
}

export type UserUsageResult = {
  users: UserUsage[]
}

type UserUsageInternal = {
  username: string
  totalMonthlyQuota: number
  organizations: Set<string>
  costCenters: Set<string>
  daily: Map<string, UserDailyUsage>
  distinctModels: Set<string>
  totals: {
    requests: number
    grossAmount: number
    discountAmount: number
    netAmount: number
    aiuQuantity: number
    aiuGrossAmount: number
    aicNetAmount: number
  }
}

function ensureModel(day: UserDailyUsage, model: string): UserModelDailyUsage {
  const existing = day.models[model]
  if (existing) return existing

  const created: UserModelDailyUsage = {
    requests: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    aiuQuantity: 0,
    aiuGrossAmount: 0,
    aicNetAmount: 0,
  }
  day.models[model] = created
  return created
}

function ensureDay(user: UserUsageInternal, date: string): UserDailyUsage {
  const existing = user.daily.get(date)
  if (existing) return existing

  const created: UserDailyUsage = {
    date,
    requests: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    aiuQuantity: 0,
    aiuGrossAmount: 0,
    aicNetAmount: 0,
    models: {},
  }
  user.daily.set(date, created)
  return created
}

export class UserUsageAggregator implements Aggregator<TokenUsageRecord, UserUsageResult, TokenUsageHeader> {
  private byUser = new Map<string, UserUsageInternal>()

  onHeader(): void {
    // header is intentionally ignored (we rely on parsed TokenUsageRecord fields)
  }

  accumulate(record: TokenUsageRecord): void {
    const username = record.username.trim()
    if (!username) return

    const date = record.date.trim()
    if (!date) return

    const model = (record.model || '—').trim() || '—'

    let user = this.byUser.get(username)
    if (!user) {
      user = {
        username,
        totalMonthlyQuota: record.total_monthly_quota,
        organizations: new Set(),
        costCenters: new Set(),
        daily: new Map(),
        distinctModels: new Set(),
        totals: {
          requests: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
          aiuQuantity: 0,
          aiuGrossAmount: 0,
          aicNetAmount: 0,
        },
      }
      this.byUser.set(username, user)
    }

    if (record.total_monthly_quota > user.totalMonthlyQuota) {
      user.totalMonthlyQuota = record.total_monthly_quota
    }

    const organization = record.organization.trim()
    if (organization) {
      user.organizations.add(organization)
    }

    const costCenter = record.cost_center_name?.trim() ?? ''
    if (costCenter) {
      user.costCenters.add(costCenter)
    }

    const { requests, grossAmount, discountAmount, netAmount, aiuQuantity, aiuGrossAmount, aicNetAmount } = getUsageMetrics(record)

    user.distinctModels.add(model)
    user.totals.requests += requests
    user.totals.grossAmount += grossAmount
    user.totals.discountAmount += discountAmount
    user.totals.netAmount += netAmount
    user.totals.aiuQuantity += aiuQuantity
    user.totals.aiuGrossAmount += aiuGrossAmount
    user.totals.aicNetAmount += aicNetAmount

    const day = ensureDay(user, date)
    day.requests += requests
    day.grossAmount += grossAmount
    day.discountAmount += discountAmount
    day.netAmount += netAmount
    day.aiuQuantity += aiuQuantity
    day.aiuGrossAmount += aiuGrossAmount
    day.aicNetAmount += aicNetAmount

    const dayModel = ensureModel(day, model)
    dayModel.requests += requests
    dayModel.grossAmount += grossAmount
    dayModel.discountAmount += discountAmount
    dayModel.netAmount += netAmount
    dayModel.aiuQuantity += aiuQuantity
    dayModel.aiuGrossAmount += aiuGrossAmount
    dayModel.aicNetAmount += aicNetAmount
  }

  result(): UserUsageResult {
    const users = Array.from(this.byUser.values())
      .sort((a, b) => a.username.localeCompare(b.username))
      .map<UserUsage>((user) => {
        const daily: Record<string, UserDailyUsage> = {}
        for (const [date, day] of user.daily.entries()) {
          daily[date] = day
        }

        return {
          username: user.username,
          totalMonthlyQuota: user.totalMonthlyQuota,
          organizations: Array.from(user.organizations).sort((a, b) => a.localeCompare(b)),
          costCenters: Array.from(user.costCenters).sort((a, b) => a.localeCompare(b)),
          daily,
          totals: {
            ...user.totals,
            distinctModels: user.distinctModels.size,
          },
        }
      })

    return { users }
  }
}
