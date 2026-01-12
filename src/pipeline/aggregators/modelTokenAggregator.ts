import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type ModelDailyTokenData = {
  date: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
}

export type ModelCostTotals = {
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type ModelTokenResult = {
  models: string[]
  byModel: Record<string, ModelDailyTokenData[]>
  totalsByModel: Record<string, ModelCostTotals>
}

type ModelInternal = {
  byDate: Map<string, ModelDailyTokenData>
  totals: ModelCostTotals
}

function ensureDay(model: ModelInternal, date: string): ModelDailyTokenData {
  const existing = model.byDate.get(date)
  if (existing) return existing
  const created: ModelDailyTokenData = {
    date,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
  }
  model.byDate.set(date, created)
  return created
}

export class ModelTokenAggregator implements Aggregator<TokenUsageRecord, ModelTokenResult, TokenUsageHeader> {
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
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
        },
      }
      this.byModel.set(modelName, model)
    }

    const day = ensureDay(model, date)
    day.totalInputTokens += record.total_input_tokens || 0
    day.totalOutputTokens += record.total_output_tokens || 0
    day.totalCacheCreationTokens += record.total_cache_creation_tokens || 0
    day.totalCacheReadTokens += record.total_cache_read_tokens || 0

    model.totals.grossAmount += record.gross_amount || 0
    model.totals.discountAmount += record.discount_amount || 0
    model.totals.netAmount += record.net_amount || 0
  }

  result(): ModelTokenResult {
    const models = Array.from(this.byModel.keys()).sort((a, b) => a.localeCompare(b))
    const byModel: Record<string, ModelDailyTokenData[]> = {}
    const totalsByModel: Record<string, ModelCostTotals> = {}

    for (const modelName of models) {
      const internal = this.byModel.get(modelName)!
      const dates = Array.from(internal.byDate.keys()).sort()
      byModel[modelName] = dates.map((d) => internal.byDate.get(d)!)
      totalsByModel[modelName] = internal.totals
    }

    return { models, byModel, totalsByModel }
  }
}
