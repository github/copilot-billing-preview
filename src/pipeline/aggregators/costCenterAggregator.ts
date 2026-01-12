import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type CostTotals = {
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type CostCenterModelTotals = CostTotals & {
  model: string
}

export type CostCenterUserTotals = {
  username: string
  netAmount: number
}

export type CostCenterUsage = {
  costCenterName: string
  userCount: number
  netCostPerUser: number
  totals: CostTotals
  totalsByModel: Record<string, CostTotals>
  netByUser: Record<string, number>
}

export type CostCenterResult = {
  costCenters: CostCenterUsage[]
}

type CostCenterInternal = {
  costCenterName: string
  users: Set<string>
  totals: CostTotals
  totalsByModel: Map<string, CostTotals>
  netByUser: Map<string, number>
}

function ensureTotals(map: Map<string, CostTotals>, key: string): CostTotals {
  const existing = map.get(key)
  if (existing) return existing
  const created: CostTotals = { grossAmount: 0, discountAmount: 0, netAmount: 0 }
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
    const model = (record.model || '—').trim() || '—'

    let cc = this.byCostCenter.get(costCenterName)
    if (!cc) {
      cc = {
        costCenterName,
        users: new Set(),
        totals: { grossAmount: 0, discountAmount: 0, netAmount: 0 },
        totalsByModel: new Map(),
        netByUser: new Map(),
      }
      this.byCostCenter.set(costCenterName, cc)
    }

    if (username) cc.users.add(username)

    const gross = record.gross_amount || 0
    const discount = record.discount_amount || 0
    const net = record.net_amount || 0

    cc.totals.grossAmount += gross
    cc.totals.discountAmount += discount
    cc.totals.netAmount += net

    const byModel = ensureTotals(cc.totalsByModel, model)
    byModel.grossAmount += gross
    byModel.discountAmount += discount
    byModel.netAmount += net

    if (username) {
      cc.netByUser.set(username, (cc.netByUser.get(username) ?? 0) + net)
    }
  }

  result(): CostCenterResult {
    const costCenters = Array.from(this.byCostCenter.values())
      .map<CostCenterUsage>((cc) => {
        const totalsByModel: Record<string, CostTotals> = {}
        for (const [model, totals] of cc.totalsByModel.entries()) {
          totalsByModel[model] = totals
        }

        const netByUser: Record<string, number> = {}
        for (const [user, net] of cc.netByUser.entries()) {
          netByUser[user] = net
        }

        const userCount = cc.users.size
        const netCostPerUser = userCount > 0 ? cc.totals.netAmount / userCount : 0

        return {
          costCenterName: cc.costCenterName,
          userCount,
          netCostPerUser,
          totals: cc.totals,
          totalsByModel,
          netByUser,
        }
      })
      .sort((a, b) => a.costCenterName.localeCompare(b.costCenterName))

    return { costCenters }
  }
}
