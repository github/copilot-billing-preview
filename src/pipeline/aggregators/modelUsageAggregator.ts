import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type ModelDailyUsageData = {
  date: string
  requests: number
  aiuQuantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type ModelUsageTotals = {
  requests: number
  aiuQuantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type ModelUsageResult = {
  models: string[]
  byModel: Record<string, ModelDailyUsageData[]>
  totalsByModel: Record<string, ModelUsageTotals>
}

type ModelInternal = {
  byDate: Map<string, ModelDailyUsageData>
  totals: ModelUsageTotals
}

function ensureDay(model: ModelInternal, date: string): ModelDailyUsageData {
  const existing = model.byDate.get(date)
  if (existing) return existing

  const created: ModelDailyUsageData = {
    date,
    requests: 0,
    aiuQuantity: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
  model.byDate.set(date, created)
  return created
}

export class ModelUsageAggregator implements Aggregator<TokenUsageRecord, ModelUsageResult, TokenUsageHeader> {
  private byModel = new Map<string, ModelInternal>()

  onHeader(): void {
    // header is intentionally ignored (we rely on parsed TokenUsageRecord fields)
  }

  accumulate(record: TokenUsageRecord): void {
    const date = record.date.trim()
    if (!date) return

    const modelName = (record.model || '—').trim() || '—'

    let model = this.byModel.get(modelName)
    if (!model) {
      model = {
        byDate: new Map(),
        totals: {
          requests: 0,
          aiuQuantity: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
        },
      }
      this.byModel.set(modelName, model)
    }

    const requests = record.quantity || 0
    const aiuQuantity = record.aiu_quantity || 0
    const grossAmount = record.gross_amount || 0
    const discountAmount = record.discount_amount || 0
    const netAmount = record.net_amount || 0

    const day = ensureDay(model, date)
    day.requests += requests
    day.aiuQuantity += aiuQuantity
    day.grossAmount += grossAmount
    day.discountAmount += discountAmount
    day.netAmount += netAmount

    model.totals.requests += requests
    model.totals.aiuQuantity += aiuQuantity
    model.totals.grossAmount += grossAmount
    model.totals.discountAmount += discountAmount
    model.totals.netAmount += netAmount
  }

  result(): ModelUsageResult {
    const models = Array.from(this.byModel.keys()).sort((a, b) => a.localeCompare(b))
    const byModel: Record<string, ModelDailyUsageData[]> = {}
    const totalsByModel: Record<string, ModelUsageTotals> = {}

    for (const modelName of models) {
      const internal = this.byModel.get(modelName)!
      const dates = Array.from(internal.byDate.keys()).sort()
      byModel[modelName] = dates.map((date) => internal.byDate.get(date)!)
      totalsByModel[modelName] = internal.totals
    }

    return { models, byModel, totalsByModel }
  }
}
