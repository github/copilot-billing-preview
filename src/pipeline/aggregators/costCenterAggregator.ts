import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'
import { getDisplayModelName } from '../modelLabels'
import { isNonCopilotCodeReviewUsage, NON_COPILOT_CODE_REVIEW_USER_LABEL } from '../productClassification'
import { pickTopEntries } from './topBreakdown'

export type CostTotals = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type CostCenterUserTotals = {
  requests: number
  grossAmount: number
  netAmount: number
  aicQuantity: number
  aicGrossAmount: number
  aicNetAmount: number
}

export type CostCenterUsage = {
  costCenterName: string
  userCount: number
  netCostPerUser: number
  totals: CostTotals
  totalsByModel: Record<string, CostTotals>
  totalsByUser: Record<string, CostCenterUserTotals>
}

export type CostCenterResult = {
  costCenters: CostCenterUsage[]
}

type CostCenterInternal = {
  costCenterName: string
  users: Set<string>
  totals: CostTotals
  totalsByModel: Map<string, CostTotals>
  totalsByUser: Map<string, CostCenterUserTotals>
}

function createCostTotals(): CostTotals {
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

function ensureTotals(map: Map<string, CostTotals>, key: string): CostTotals {
  const existing = map.get(key)
  if (existing) return existing
  const created = createCostTotals()
  map.set(key, created)
  return created
}

function ensureUserTotals(map: Map<string, CostCenterUserTotals>, key: string): CostCenterUserTotals {
  const existing = map.get(key)
  if (existing) return existing
  const created: CostCenterUserTotals = { requests: 0, grossAmount: 0, netAmount: 0, aicQuantity: 0, aicGrossAmount: 0, aicNetAmount: 0 }
  map.set(key, created)
  return created
}

export class CostCenterAggregator implements Aggregator<TokenUsageRecord, CostCenterResult, TokenUsageHeader> {
  private byCostCenter = new Map<string, CostCenterInternal>()

  onHeader(): void {
    // header is intentionally ignored (we rely on parsed TokenUsageRecord fields)
  }

  accumulate(record: TokenUsageRecord): void {
    const costCenterName = record.cost_center_name?.trim() ?? ''
    if (!costCenterName) return

    const username = record.username.trim()
    const model = getDisplayModelName(record.model)

    let costCenter = this.byCostCenter.get(costCenterName)
    if (!costCenter) {
      costCenter = {
        costCenterName,
        users: new Set(),
        totals: createCostTotals(),
        totalsByModel: new Map(),
        totalsByUser: new Map(),
      }
      this.byCostCenter.set(costCenterName, costCenter)
    }

    const specialUsageLabel = isNonCopilotCodeReviewUsage(record) ? NON_COPILOT_CODE_REVIEW_USER_LABEL : null

    if (username) costCenter.users.add(username)

    const { requests, grossAmount, discountAmount, netAmount, aicQuantity, aicGrossAmount, aicNetAmount } = getUsageMetrics(record)

    costCenter.totals.requests += requests
    costCenter.totals.grossAmount += grossAmount
    costCenter.totals.discountAmount += discountAmount
    costCenter.totals.netAmount += netAmount
    costCenter.totals.aicQuantity += aicQuantity
    costCenter.totals.aicGrossAmount += aicGrossAmount
    costCenter.totals.aicNetAmount += aicNetAmount

    const byModel = ensureTotals(costCenter.totalsByModel, model)
    byModel.requests += requests
    byModel.grossAmount += grossAmount
    byModel.discountAmount += discountAmount
    byModel.netAmount += netAmount
    byModel.aicQuantity += aicQuantity
    byModel.aicGrossAmount += aicGrossAmount
    byModel.aicNetAmount += aicNetAmount

    const userBreakdownLabel = username || specialUsageLabel
    if (userBreakdownLabel) {
      const byUser = ensureUserTotals(costCenter.totalsByUser, userBreakdownLabel)
      byUser.requests += requests
      byUser.grossAmount += grossAmount
      byUser.netAmount += netAmount
      byUser.aicQuantity += aicQuantity
      byUser.aicGrossAmount += aicGrossAmount
      byUser.aicNetAmount += aicNetAmount
    }
  }

  result(): CostCenterResult {
    const costCenters = Array.from(this.byCostCenter.values())
      .map<CostCenterUsage>((costCenter) => {
        const userCount = costCenter.users.size
        const netCostPerUser = userCount > 0 ? costCenter.totals.netAmount / userCount : 0

        return {
          costCenterName: costCenter.costCenterName,
          userCount,
          netCostPerUser,
          totals: costCenter.totals,
          totalsByModel: pickTopEntries(costCenter.totalsByModel.entries()),
          totalsByUser: pickTopEntries(costCenter.totalsByUser.entries()),
        }
      })
      .sort((a, b) => a.costCenterName.localeCompare(b.costCenterName))

    return { costCenters }
  }
}
