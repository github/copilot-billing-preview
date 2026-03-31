import {
  getAicUsageMetrics,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import { streamLines } from './streamer'

export const BUSINESS_MONTHLY_QUOTA = 300
export const ENTERPRISE_MONTHLY_QUOTA = 1000

export const BUSINESS_MONTHLY_AIC_ENTITLEMENTS = 3000
export const ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS = 7000

export type AicEntitlementTier = 'business' | 'enterprise' | null

export type LicenseSummaryRow = {
  label: 'Copilot Business' | 'Copilot Enterprise'
  users: number
  includedAic: number
}

export type LicenseSummary = {
  rows: LicenseSummaryRow[]
  totalUsers: number
  totalIncludedAic: number
}

export function getAicEntitlementTier(totalMonthlyQuota: number): AicEntitlementTier {
  if (totalMonthlyQuota === ENTERPRISE_MONTHLY_QUOTA) return 'enterprise'
  if (totalMonthlyQuota === BUSINESS_MONTHLY_QUOTA) return 'business'
  return null
}

export function getMonthlyAicEntitlements(totalMonthlyQuota: number): number {
  const tier = getAicEntitlementTier(totalMonthlyQuota)
  if (tier === 'enterprise') return ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS
  if (tier === 'business') return BUSINESS_MONTHLY_AIC_ENTITLEMENTS
  return 0
}

export function calculateLicenseSummary(users: { totalMonthlyQuota: number }[]): LicenseSummary {
  const rows: LicenseSummaryRow[] = [
    { label: 'Copilot Business', users: 0, includedAic: 0 },
    { label: 'Copilot Enterprise', users: 0, includedAic: 0 },
  ]

  users.forEach((user) => {
    const tier = getAicEntitlementTier(user.totalMonthlyQuota)
    const includedAic = getMonthlyAicEntitlements(user.totalMonthlyQuota)

    if (tier === 'business') {
      rows[0].users += 1
      rows[0].includedAic += includedAic
    }

    if (tier === 'enterprise') {
      rows[1].users += 1
      rows[1].includedAic += includedAic
    }
  })

  return {
    rows,
    totalUsers: rows.reduce((sum, row) => sum + row.users, 0),
    totalIncludedAic: rows.reduce((sum, row) => sum + row.includedAic, 0),
  }
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
    const { aicQuantity, aicGrossAmount } = getAicUsageMetrics(record)

    if (aicQuantity <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    if (aicGrossAmount <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const coveredQuantity = Math.min(aicQuantity, this.remainingEntitlements)
    this.remainingEntitlements = Math.max(this.remainingEntitlements - coveredQuantity, 0)

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remaining(): number {
    return this.remainingEntitlements
  }
}
