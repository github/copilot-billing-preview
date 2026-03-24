import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type UserModelDailyUsage = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
}

export type UserDailyUsage = {
  date: string
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
  models: Record<string, UserModelDailyUsage>
}

export type UserUsage = {
  username: string
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
  daily: Map<string, UserDailyUsage>
  distinctModels: Set<string>
  totals: {
    requests: number
    grossAmount: number
    discountAmount: number
    netAmount: number
    aiuQuantity: number
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
        daily: new Map(),
        distinctModels: new Set(),
        totals: {
          requests: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
          aiuQuantity: 0,
        },
      }
      this.byUser.set(username, user)
    }

    const requests = record.quantity || 0
    const grossAmount = record.gross_amount || 0
    const discountAmount = record.discount_amount || 0
    const netAmount = record.net_amount || 0
    const aiuQuantity = record.aiu_quantity || 0

    user.distinctModels.add(model)
    user.totals.requests += requests
    user.totals.grossAmount += grossAmount
    user.totals.discountAmount += discountAmount
    user.totals.netAmount += netAmount
    user.totals.aiuQuantity += aiuQuantity

    const day = ensureDay(user, date)
    day.requests += requests
    day.grossAmount += grossAmount
    day.discountAmount += discountAmount
    day.netAmount += netAmount
    day.aiuQuantity += aiuQuantity

    const dayModel = ensureModel(day, model)
    dayModel.requests += requests
    dayModel.grossAmount += grossAmount
    dayModel.discountAmount += discountAmount
    dayModel.netAmount += netAmount
    dayModel.aiuQuantity += aiuQuantity
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
