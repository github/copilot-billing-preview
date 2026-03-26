import {
  getAicUsageMetrics,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import { streamLines } from './streamer'

const BUSINESS_MONTHLY_QUOTA = 300
const ENTERPRISE_MONTHLY_QUOTA = 1000

const BUSINESS_MONTHLY_AIC_ENTITLEMENTS = 3000
const ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS = 7000

export function getMonthlyAicEntitlements(totalMonthlyQuota: number): number {
  if (totalMonthlyQuota === ENTERPRISE_MONTHLY_QUOTA) return ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS
  if (totalMonthlyQuota === BUSINESS_MONTHLY_QUOTA) return BUSINESS_MONTHLY_AIC_ENTITLEMENTS
  return 0
}

export async function calculateAicEntitlementPool(file: File): Promise<number> {
  let header: TokenUsageHeader | null = null
  const quotasByUser = new Map<string, number>()

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      continue
    }

    const record = parseTokenUsageRecord(trimmed, header)
    const username = record.username.trim()
    if (!username) continue

    const currentQuota = quotasByUser.get(username) ?? 0
    if (record.total_monthly_quota > currentQuota) {
      quotasByUser.set(username, record.total_monthly_quota)
    }
  }

  return Array.from(quotasByUser.values()).reduce((total, quota) => total + getMonthlyAicEntitlements(quota), 0)
}

export class PooledAicEntitlementAllocator {
  private remainingEntitlements: number

  constructor(totalEntitlements: number) {
    this.remainingEntitlements = totalEntitlements
  }

  apply(record: TokenUsageRecord): TokenUsageRecord {
    const { aiuQuantity, aiuGrossAmount } = getAicUsageMetrics(record)

    if (aiuQuantity <= 0) {
      record.aic_net_amount = aiuGrossAmount
      return record
    }

    const coveredQuantity = Math.min(aiuQuantity, this.remainingEntitlements)
    this.remainingEntitlements = Math.max(this.remainingEntitlements - coveredQuantity, 0)

    if (aiuGrossAmount <= 0) {
      record.aic_net_amount = aiuGrossAmount
      return record
    }

    const uncoveredRatio = Math.max(aiuQuantity - coveredQuantity, 0) / aiuQuantity
    record.aic_net_amount = aiuGrossAmount * uncoveredRatio
    return record
  }

  remaining(): number {
    return this.remainingEntitlements
  }
}