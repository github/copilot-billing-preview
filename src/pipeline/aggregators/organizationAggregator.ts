import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'
import { getDisplayModelName } from '../modelLabels'
import { isNonCopilotCodeReviewUsage, NON_COPILOT_CODE_REVIEW_USER_LABEL } from '../productClassification'
import { pickTopEntries } from './topBreakdown'

export type OrgTotals = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type OrgUserTotals = {
  requests: number
  grossAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type OrganizationUsage = {
  organization: string
  userCount: number
  totals: OrgTotals
  totalsByModel: Record<string, OrgTotals>
  totalsByUser: Record<string, OrgUserTotals>
}

export type OrganizationResult = {
  organizations: OrganizationUsage[]
}

type OrgInternal = {
  organization: string
  users: Set<string>
  totals: OrgTotals
  totalsByModel: Map<string, OrgTotals>
  totalsByUser: Map<string, OrgUserTotals>
}

function createOrgTotals(): OrgTotals {
  return { requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0, aicQuantity: 0, aicGrossAmount: 0, aicNetAmount: 0 }
}

function ensureOrgTotals(map: Map<string, OrgTotals>, key: string): OrgTotals {
  const existing = map.get(key)
  if (existing) return existing
  const created = createOrgTotals()
  map.set(key, created)
  return created
}

function ensureUserTotals(map: Map<string, OrgUserTotals>, key: string): OrgUserTotals {
  const existing = map.get(key)
  if (existing) return existing
  const created: OrgUserTotals = { requests: 0, grossAmount: 0, netAmount: 0, aicQuantity: 0, aicGrossAmount: 0, aicNetAmount: 0 }
  map.set(key, created)
  return created
}

export class OrganizationAggregator implements Aggregator<TokenUsageRecord, OrganizationResult, TokenUsageHeader> {
  private byOrg = new Map<string, OrgInternal>()

  onHeader(): void {
    // header is intentionally ignored (we rely on parsed TokenUsageRecord fields)
  }

  accumulate(record: TokenUsageRecord): void {
    const organization = record.organization.trim()
    if (!organization) return

    const username = record.username.trim()
    const model = getDisplayModelName(record.model)

    let org = this.byOrg.get(organization)
    if (!org) {
      org = {
        organization,
        users: new Set(),
        totals: createOrgTotals(),
        totalsByModel: new Map(),
        totalsByUser: new Map(),
      }
      this.byOrg.set(organization, org)
    }

    const specialUsageLabel = isNonCopilotCodeReviewUsage(record) ? NON_COPILOT_CODE_REVIEW_USER_LABEL : null

    if (username) org.users.add(username)

    const { requests, grossAmount, discountAmount, netAmount, aicQuantity, aicGrossAmount, aicNetAmount } = getUsageMetrics(record)

    org.totals.requests += requests
    org.totals.grossAmount += grossAmount
    org.totals.discountAmount += discountAmount
    org.totals.netAmount += netAmount
    org.totals.aicQuantity += aicQuantity
    org.totals.aicGrossAmount += aicGrossAmount
    org.totals.aicNetAmount += aicNetAmount

    const byModel = ensureOrgTotals(org.totalsByModel, model)
    byModel.requests += requests
    byModel.grossAmount += grossAmount
    byModel.discountAmount += discountAmount
    byModel.netAmount += netAmount
    byModel.aicQuantity += aicQuantity
    byModel.aicGrossAmount += aicGrossAmount
    byModel.aicNetAmount += aicNetAmount

    const userBreakdownLabel = username || specialUsageLabel
    if (userBreakdownLabel) {
      const byUser = ensureUserTotals(org.totalsByUser, userBreakdownLabel)
      byUser.requests += requests
      byUser.grossAmount += grossAmount
      byUser.netAmount += netAmount
      byUser.aicQuantity += aicQuantity
      byUser.aicGrossAmount += aicGrossAmount
      byUser.aicNetAmount += aicNetAmount
    }
  }

  result(): OrganizationResult {
    const organizations = Array.from(this.byOrg.values())
      .map<OrganizationUsage>((org) => ({
        organization: org.organization,
        userCount: org.users.size,
        totals: org.totals,
        totalsByModel: pickTopEntries(org.totalsByModel.entries()),
        totalsByUser: pickTopEntries(org.totalsByUser.entries()),
      }))
      .sort((a, b) => a.organization.localeCompare(b.organization))

    return { organizations }
  }
}
