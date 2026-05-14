import {
  getAicUsageMetrics,
  parseTokenUsageHeader,
  parseNormalizedTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import { streamLines, type StreamProgress } from './streamer'

export const BUSINESS_MONTHLY_QUOTA = 300
export const ENTERPRISE_MONTHLY_QUOTA = 1000
export const PRO_MONTHLY_QUOTA = 300
export const PRO_PLUS_MONTHLY_QUOTA = 1500

export const BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS = 3000
export const ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS = 7000
export const PRO_MONTHLY_AIC_INCLUDED_CREDITS = 1500
export const PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS = 7000

export type AicIncludedCreditsOverrides = {
  business?: number
  enterprise?: number
}

export type ReportPlanScope = 'individual' | 'organization'
export type AicIncludedCreditTier = 'business' | 'enterprise' | null
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

export interface AicIncludedCreditsProgressOptions {
  onProgress?: (progress: StreamProgress) => void
}

type ReportScopeUser = {
  organizations?: string[]
  costCenters?: string[]
}

export type AicIncludedCreditsContext = {
  reportPlanScope: ReportPlanScope
  organizationIncludedCreditsPool: number
  individualMonthlyIncludedCredits: number
}

function normalizeSeatCount(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function calculateOrganizationIncludedCreditsPool(overrides: AicIncludedCreditsOverrides): number | null {
  const businessSeats = normalizeSeatCount(overrides.business)
  const enterpriseSeats = normalizeSeatCount(overrides.enterprise)

  if (businessSeats === null && enterpriseSeats === null) return null

  return (
    (businessSeats ?? 0) * BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS
    + (enterpriseSeats ?? 0) * ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS
  )
}

export function inferReportPlanScope(userCount: number, hasOrganizationContext = false): ReportPlanScope {
  return userCount === 1 && !hasOrganizationContext ? 'individual' : 'organization'
}

export function getPlanLabel(totalMonthlyQuota: number, reportPlanScope: ReportPlanScope = 'organization'): string {
  const organizationTier = getAicIncludedCreditTier(totalMonthlyQuota, reportPlanScope)
  if (organizationTier === 'business') return 'Copilot Business'
  if (organizationTier === 'enterprise') return 'Copilot Enterprise'

  const individualTier = getIndividualPlanTier(totalMonthlyQuota, reportPlanScope)
  if (individualTier === 'pro-student') return 'Copilot Pro/Student'
  if (individualTier === 'pro-plus') return 'Copilot Pro+'

  if (totalMonthlyQuota > 0) return `Unknown (${totalMonthlyQuota.toLocaleString()} PRUs/month)`
  return 'Unknown'
}

export function getAicIncludedCreditTier(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
): AicIncludedCreditTier {
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
  if (totalMonthlyQuota === PRO_MONTHLY_QUOTA) return 'pro-student'
  return null
}

export function getMonthlyAicIncludedCredits(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
): number {
  const tier = getAicIncludedCreditTier(totalMonthlyQuota, reportPlanScope)
  if (tier === 'enterprise') return ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS
  if (tier === 'business') return BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS
  return 0
}

export function getIndividualMonthlyAicIncludedCredits(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'individual',
): number {
  const tier = getIndividualPlanTier(totalMonthlyQuota, reportPlanScope)
  if (tier === 'pro-plus') return PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS
  if (tier === 'pro-student') return PRO_MONTHLY_AIC_INCLUDED_CREDITS
  return 0
}

export function calculateLicenseSummary(
  users: Array<{ totalMonthlyQuota: number } & ReportScopeUser>,
): LicenseSummary {
  const reportPlanScope = inferReportPlanScope(users.length, hasOrganizationContext(users))
  if (reportPlanScope === 'individual') {
    const quota = users[0]?.totalMonthlyQuota ?? 0
    const includedAic = getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope)

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
    const tier = getAicIncludedCreditTier(user.totalMonthlyQuota, reportPlanScope)
    const includedAic = getMonthlyAicIncludedCredits(user.totalMonthlyQuota, reportPlanScope)

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

export async function calculateAicIncludedCreditsContext(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
  options?: AicIncludedCreditsProgressOptions,
): Promise<AicIncludedCreditsContext> {
  let header: TokenUsageHeader | null = null
  const quotasByUser = new Map<string, number>()
  let hasOrganizationContext = false

  for await (const line of streamLines(file, options)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      continue
    }

    const record = parseNormalizedTokenUsageRecord(trimmed, header)
    if (!record) continue

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
      organizationIncludedCreditsPool: 0,
      individualMonthlyIncludedCredits: getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope),
    }
  }

  const overriddenOrganizationIncludedCreditPool = calculateOrganizationIncludedCreditsPool(overrides)

  return {
    reportPlanScope,
    organizationIncludedCreditsPool: overriddenOrganizationIncludedCreditPool ?? Array.from(quotasByUser.values()).reduce(
      (total, quota) => total + getMonthlyAicIncludedCredits(quota, reportPlanScope),
      0,
    ),
    individualMonthlyIncludedCredits: 0,
  }
}

export async function calculateAicIncludedCreditsPool(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
): Promise<number> {
  const includedCreditsContext = await calculateAicIncludedCreditsContext(file, overrides)

  return includedCreditsContext.organizationIncludedCreditsPool
}

export class PooledAicIncludedCreditsAllocator {
  private remainingIncludedCredits: number

  constructor(totalIncludedCredits: number) {
    this.remainingIncludedCredits = totalIncludedCredits
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

    const coveredQuantity = Math.min(aicQuantity, this.remainingIncludedCredits)
    this.remainingIncludedCredits = Math.max(this.remainingIncludedCredits - coveredQuantity, 0)

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remaining(): number {
    return this.remainingIncludedCredits
  }
}

export class IndividualAicIncludedCreditsAllocator {
  private readonly remainingIncludedCreditsByMonth = new Map<string, number>()
  private readonly monthlyIncludedCredits: number

  constructor(monthlyIncludedCredits: number) {
    this.monthlyIncludedCredits = monthlyIncludedCredits
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
    const monthKey = getUsageMonthKey(record.date.trim())
    if (!username || !monthKey || this.monthlyIncludedCredits <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const monthlyKey = `${username}\u0000${monthKey}`
    const remainingIncludedCredits = this.remainingIncludedCreditsByMonth.get(monthlyKey) ?? this.monthlyIncludedCredits
    const coveredQuantity = Math.min(aicQuantity, remainingIncludedCredits)
    this.remainingIncludedCreditsByMonth.set(monthlyKey, Math.max(remainingIncludedCredits - coveredQuantity, 0))

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remainingFor(username: string, date: string): number {
    const monthKey = getUsageMonthKey(date.trim())
    if (!monthKey) return 0
    return this.remainingIncludedCreditsByMonth.get(`${username.trim()}\u0000${monthKey}`) ?? this.monthlyIncludedCredits
  }
}

export async function createAicIncludedCreditsAllocator(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
  options?: AicIncludedCreditsProgressOptions,
): Promise<PooledAicIncludedCreditsAllocator | IndividualAicIncludedCreditsAllocator> {
  const includedCreditsContext = await calculateAicIncludedCreditsContext(file, overrides, options)

  if (includedCreditsContext.reportPlanScope === 'individual') {
    return new IndividualAicIncludedCreditsAllocator(includedCreditsContext.individualMonthlyIncludedCredits)
  }

  return new PooledAicIncludedCreditsAllocator(includedCreditsContext.organizationIncludedCreditsPool)
}

export function getUsageMonthKey(value: string): string | null {
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

  return value.slice(0, 7)
}

function hasOrganizationContext(users: ReportScopeUser[]): boolean {
  return users.some((user) => {
    const organizations = user.organizations ?? []
    const costCenters = user.costCenters ?? []
    return organizations.length > 0 || costCenters.length > 0
  })
}
