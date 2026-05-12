import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'
import { getDisplayModelName } from '../modelLabels'
import { getFriendlyProductName } from '../productClassification'

export type UserModelDailyUsage = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type UserDailyUsage = {
  date: string
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
  models: Record<string, UserModelDailyUsage>
}

export type UserProductUsage = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type UserProductBreakdown = {
  totals: UserProductUsage
  models: Record<string, UserProductUsage>
}

export type UserUsage = {
  username: string
  totalMonthlyQuota: number
  organizations: string[]
  costCenters: string[]
  daily: Record<string, UserDailyUsage>
  products: Record<string, UserProductBreakdown>
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
  products: Map<string, { totals: UserProductUsage; models: Map<string, UserProductUsage> }>
  distinctModels: Set<string>
  totals: {
    requests: number
    grossAmount: number
    discountAmount: number
    netAmount: number
    aicQuantity: number
    aicGrossAmount: number
    aicNetAmount: number
  }
}

function createUserProductUsage(): UserProductUsage {
  return {
    requests: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
    aicQuantity: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
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
    aicQuantity: 0,
    aicGrossAmount: 0,
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
    aicQuantity: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
    models: {},
  }
  user.daily.set(date, created)
  return created
}

function ensureProduct(user: UserUsageInternal, product: string): { totals: UserProductUsage; models: Map<string, UserProductUsage> } {
  const existing = user.products.get(product)
  if (existing) return existing

  const created = {
    totals: createUserProductUsage(),
    models: new Map<string, UserProductUsage>(),
  }
  user.products.set(product, created)
  return created
}

function ensureProductModel(product: { models: Map<string, UserProductUsage> }, model: string): UserProductUsage {
  const existing = product.models.get(model)
  if (existing) return existing

  const created = createUserProductUsage()
  product.models.set(model, created)
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

    const model = getDisplayModelName(record.model)
    const product = getFriendlyProductName(record)

    let user = this.byUser.get(username)
    if (!user) {
      user = {
        username,
        totalMonthlyQuota: record.total_monthly_quota,
        organizations: new Set(),
        costCenters: new Set(),
        daily: new Map(),
        products: new Map(),
        distinctModels: new Set(),
        totals: {
          requests: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
          aicQuantity: 0,
          aicGrossAmount: 0,
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

    const { requests, grossAmount, discountAmount, netAmount, aicQuantity, aicGrossAmount, aicNetAmount } = getUsageMetrics(record)

    user.distinctModels.add(model)
    user.totals.requests += requests
    user.totals.grossAmount += grossAmount
    user.totals.discountAmount += discountAmount
    user.totals.netAmount += netAmount
    user.totals.aicQuantity += aicQuantity
    user.totals.aicGrossAmount += aicGrossAmount
    user.totals.aicNetAmount += aicNetAmount

    const day = ensureDay(user, date)
    day.requests += requests
    day.grossAmount += grossAmount
    day.discountAmount += discountAmount
    day.netAmount += netAmount
    day.aicQuantity += aicQuantity
    day.aicGrossAmount += aicGrossAmount
    day.aicNetAmount += aicNetAmount

    const dayModel = ensureModel(day, model)
    dayModel.requests += requests
    dayModel.grossAmount += grossAmount
    dayModel.discountAmount += discountAmount
    dayModel.netAmount += netAmount
    dayModel.aicQuantity += aicQuantity
    dayModel.aicGrossAmount += aicGrossAmount
    dayModel.aicNetAmount += aicNetAmount

    const productUsage = ensureProduct(user, product)
    productUsage.totals.requests += requests
    productUsage.totals.grossAmount += grossAmount
    productUsage.totals.discountAmount += discountAmount
    productUsage.totals.netAmount += netAmount
    productUsage.totals.aicQuantity += aicQuantity
    productUsage.totals.aicGrossAmount += aicGrossAmount
    productUsage.totals.aicNetAmount += aicNetAmount

    const productModelUsage = ensureProductModel(productUsage, model)
    productModelUsage.requests += requests
    productModelUsage.grossAmount += grossAmount
    productModelUsage.discountAmount += discountAmount
    productModelUsage.netAmount += netAmount
    productModelUsage.aicQuantity += aicQuantity
    productModelUsage.aicGrossAmount += aicGrossAmount
    productModelUsage.aicNetAmount += aicNetAmount
  }

  result(): UserUsageResult {
    const users = Array.from(this.byUser.values())
      .sort((a, b) => a.username.localeCompare(b.username))
      .map<UserUsage>((user) => {
        const daily: Record<string, UserDailyUsage> = {}
        for (const [date, day] of user.daily.entries()) {
          daily[date] = day
        }

        const products = Object.fromEntries(
          Array.from(user.products.entries()).sort((a, b) => {
            const costDiff = b[1].totals.netAmount - a[1].totals.netAmount
            return costDiff !== 0 ? costDiff : a[0].localeCompare(b[0])
          }).map(([product, usage]) => [
            product,
            {
              totals: usage.totals,
              models: Object.fromEntries(
                Array.from(usage.models.entries()).sort((a, b) => {
                  const costDiff = b[1].netAmount - a[1].netAmount
                  return costDiff !== 0 ? costDiff : a[0].localeCompare(b[0])
                }),
              ),
            },
          ]),
        )

        return {
          username: user.username,
          totalMonthlyQuota: user.totalMonthlyQuota,
          organizations: Array.from(user.organizations).sort((a, b) => a.localeCompare(b)),
          costCenters: Array.from(user.costCenters).sort((a, b) => a.localeCompare(b)),
          daily,
          products,
          totals: {
            ...user.totals,
            distinctModels: user.distinctModels.size,
          },
        }
      })

    return { users }
  }
}
