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
export const PRO_PLUS_MONTHLY_QUOTA = 1500

export const BUSINESS_MONTHLY_AIC_ENTITLEMENTS = 3000
export const ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS = 7000
export const PRO_WEEKLY_AIC_ENTITLEMENTS = 1800
export const PRO_PLUS_WEEKLY_AIC_ENTITLEMENTS = 7500

export type ReportPlanScope = 'individual' | 'organization'
export type AicEntitlementTier = 'business' | 'enterprise' | null
export type IndividualPlanTier = 'pro-student' | 'pro-plus' | null

export type LicenseSummaryRow = {
  label: string
  users: number
  includedAic: number
}

export type LicenseSummary = {
  rows: LicenseSummaryRow[]
  totalUsers: number
  totalIncludedAic: number
}

type ReportScopeUser = {
  organizations?: string[]
  costCenters?: string[]
}

type AicEntitlementContext = {
  reportPlanScope: ReportPlanScope
  organizationEntitlementPool: number
  individualWeeklyEntitlements: number
}

export function inferReportPlanScope(userCount: number, hasOrganizationContext = false): ReportPlanScope {
  return userCount === 1 && !hasOrganizationContext ? 'individual' : 'organization'
}

export function getPlanLabel(totalMonthlyQuota: number, reportPlanScope: ReportPlanScope = 'organization'): string {
  const organizationTier = getAicEntitlementTier(totalMonthlyQuota, reportPlanScope)
  if (organizationTier === 'business') return 'Copilot Business'
  if (organizationTier === 'enterprise') return 'Copilot Enterprise'

  const individualTier = getIndividualPlanTier(totalMonthlyQuota, reportPlanScope)
  if (individualTier === 'pro-student') return 'Copilot Pro/Student'
  if (individualTier === 'pro-plus') return 'Copilot Pro+'

  if (totalMonthlyQuota > 0) return `Unknown (${totalMonthlyQuota.toLocaleString()} PRUs/month)`
  return 'Unknown'
}

export function getAicEntitlementTier(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
): AicEntitlementTier {
  if (reportPlanScope !== 'organization') return null
  if (totalMonthlyQuota === ENTERPRISE_MONTHLY_QUOTA) return 'enterprise'
  if (totalMonthlyQuota === BUSINESS_MONTHLY_QUOTA) return 'business'
  return null
}

export function getIndividualPlanTier(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'individual',
): IndividualPlanTier {
  if (reportPlanScope !== 'individual') return null
  if (totalMonthlyQuota === PRO_PLUS_MONTHLY_QUOTA) return 'pro-plus'
  if (totalMonthlyQuota === BUSINESS_MONTHLY_QUOTA) return 'pro-student'
  return null
}

export function getMonthlyAicEntitlements(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
): number {
  const tier = getAicEntitlementTier(totalMonthlyQuota, reportPlanScope)
  if (tier === 'enterprise') return ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS
  if (tier === 'business') return BUSINESS_MONTHLY_AIC_ENTITLEMENTS
  return 0
}

export function getIndividualWeeklyAicEntitlements(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'individual',
): number {
  const tier = getIndividualPlanTier(totalMonthlyQuota, reportPlanScope)
  if (tier === 'pro-plus') return PRO_PLUS_WEEKLY_AIC_ENTITLEMENTS
  if (tier === 'pro-student') return PRO_WEEKLY_AIC_ENTITLEMENTS
  return 0
}

export function calculateLicenseSummary(
  users: Array<{ totalMonthlyQuota: number } & ReportScopeUser>,
): LicenseSummary {
  const reportPlanScope = inferReportPlanScope(users.length, hasOrganizationContext(users))
  if (reportPlanScope === 'individual') {
    const quota = users[0]?.totalMonthlyQuota ?? 0
    const includedAic = getIndividualWeeklyAicEntitlements(quota, reportPlanScope)

    return {
      rows: users.length === 1
        ? [{ label: getPlanLabel(quota, reportPlanScope), users: 1, includedAic }]
        : [],
      totalUsers: users.length,
      totalIncludedAic: includedAic,
    }
  }

  const rows: LicenseSummaryRow[] = [
    { label: 'Copilot Business', users: 0, includedAic: 0 },
    { label: 'Copilot Enterprise', users: 0, includedAic: 0 },
  ]

  users.forEach((user) => {
    const tier = getAicEntitlementTier(user.totalMonthlyQuota, reportPlanScope)
    const includedAic = getMonthlyAicEntitlements(user.totalMonthlyQuota, reportPlanScope)

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

async function calculateAicEntitlementContext(file: File): Promise<AicEntitlementContext> {
  let header: TokenUsageHeader | null = null
  const quotasByUser = new Map<string, number>()
  let hasOrganizationContext = false

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

    if (record.organization.trim() || (record.cost_center_name?.trim() ?? '')) {
      hasOrganizationContext = true
    }

    const currentQuota = quotasByUser.get(username) ?? 0
    if (record.total_monthly_quota > currentQuota) {
      quotasByUser.set(username, record.total_monthly_quota)
    }
  }

  const reportPlanScope = inferReportPlanScope(quotasByUser.size, hasOrganizationContext)
  if (reportPlanScope === 'individual') {
    const quota = quotasByUser.values().next().value ?? 0
    return {
      reportPlanScope,
      organizationEntitlementPool: 0,
      individualWeeklyEntitlements: getIndividualWeeklyAicEntitlements(quota, reportPlanScope),
    }
  }

  return {
    reportPlanScope,
    organizationEntitlementPool: Array.from(quotasByUser.values()).reduce(
      (total, quota) => total + getMonthlyAicEntitlements(quota, reportPlanScope),
      0,
    ),
    individualWeeklyEntitlements: 0,
  }
}

export async function calculateAicEntitlementPool(file: File): Promise<number> {
  const entitlementContext = await calculateAicEntitlementContext(file)

  return entitlementContext.organizationEntitlementPool
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

export class IndividualAicEntitlementAllocator {
  private readonly remainingEntitlementsByWeek = new Map<string, number>()
  private readonly weeklyEntitlements: number

  constructor(weeklyEntitlements: number) {
    this.weeklyEntitlements = weeklyEntitlements
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

    const username = record.username.trim()
    const weekStart = getIsoWeekStart(record.date.trim())
    if (!username || !weekStart || this.weeklyEntitlements <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const weeklyKey = `${username}\u0000${weekStart}`
    const remainingEntitlements = this.remainingEntitlementsByWeek.get(weeklyKey) ?? this.weeklyEntitlements
    const coveredQuantity = Math.min(aicQuantity, remainingEntitlements)
    this.remainingEntitlementsByWeek.set(weeklyKey, Math.max(remainingEntitlements - coveredQuantity, 0))

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remainingFor(username: string, date: string): number {
    const weekStart = getIsoWeekStart(date.trim())
    if (!weekStart) return 0
    return this.remainingEntitlementsByWeek.get(`${username.trim()}\u0000${weekStart}`) ?? this.weeklyEntitlements
  }
}

export async function createAicEntitlementAllocator(
  file: File,
): Promise<PooledAicEntitlementAllocator | IndividualAicEntitlementAllocator> {
  const entitlementContext = await calculateAicEntitlementContext(file)

  if (entitlementContext.reportPlanScope === 'individual') {
    return new IndividualAicEntitlementAllocator(entitlementContext.individualWeeklyEntitlements)
  }

  return new PooledAicEntitlementAllocator(entitlementContext.organizationEntitlementPool)
}

function getIsoWeekStart(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }

  const isoDay = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - (isoDay - 1))

  return date.toISOString().slice(0, 10)
}

function hasOrganizationContext(users: ReportScopeUser[]): boolean {
  return users.some((user) => {
    const organizations = user.organizations ?? []
    const costCenters = user.costCenters ?? []
    return organizations.length > 0 || costCenters.length > 0
  })
}
