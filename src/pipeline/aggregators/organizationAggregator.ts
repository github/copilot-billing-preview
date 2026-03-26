import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'

export type OrganizationUsage = {
  organization: string
  userCount: number
  modelCount: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
  aicNetAmount: number
}

export type OrganizationResult = {
  organizations: OrganizationUsage[]
}

type OrgInternal = {
  organization: string
  users: Set<string>
  models: Set<string>
  grossAmount: number
  discountAmount: number
  netAmount: number
  aiuQuantity: number
  aicNetAmount: number
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
    const model = (record.model || '—').trim() || '—'

    let org = this.byOrg.get(organization)
    if (!org) {
      org = {
        organization,
        users: new Set(),
        models: new Set(),
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aiuQuantity: 0,
        aicNetAmount: 0,
      }
      this.byOrg.set(organization, org)
    }

    if (username) org.users.add(username)
    org.models.add(model)

    const { grossAmount, discountAmount, netAmount, aiuQuantity, aicNetAmount } = getUsageMetrics(record)

    org.grossAmount += grossAmount
    org.discountAmount += discountAmount
    org.netAmount += netAmount
    org.aiuQuantity += aiuQuantity
    org.aicNetAmount += aicNetAmount
  }

  result(): OrganizationResult {
    const organizations = Array.from(this.byOrg.values())
      .map<OrganizationUsage>((org) => ({
        organization: org.organization,
        userCount: org.users.size,
        modelCount: org.models.size,
        grossAmount: org.grossAmount,
        discountAmount: org.discountAmount,
        netAmount: org.netAmount,
        aiuQuantity: org.aiuQuantity,
        aicNetAmount: org.aicNetAmount,
      }))
      .sort((a, b) => a.organization.localeCompare(b.organization))

    return { organizations }
  }
}
