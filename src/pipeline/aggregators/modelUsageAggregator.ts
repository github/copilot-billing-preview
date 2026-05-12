import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'
import { getDisplayModelName } from '../modelLabels'

export type ModelDailyUsageData = {
  date: string
  requests: number
  aicQuantity: number
  grossAmount: number
  aicGrossAmount: number
  aicNetAmount: number
  discountAmount: number
  netAmount: number
}

export type ModelUsageTotals = {
  requests: number
  aicQuantity: number
  grossAmount: number
  aicGrossAmount: number
  aicNetAmount: number
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
    aicQuantity: 0,
    grossAmount: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
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

    const modelName = getDisplayModelName(record.model)

    let model = this.byModel.get(modelName)
    if (!model) {
      model = {
        byDate: new Map(),
        totals: {
          requests: 0,
          aicQuantity: 0,
          grossAmount: 0,
          aicGrossAmount: 0,
          aicNetAmount: 0,
          discountAmount: 0,
          netAmount: 0,
        },
      }
      this.byModel.set(modelName, model)
    }

    const { requests, aicQuantity, grossAmount, aicGrossAmount, aicNetAmount, discountAmount, netAmount } = getUsageMetrics(record)

    const day = ensureDay(model, date)
    day.requests += requests
    day.aicQuantity += aicQuantity
    day.grossAmount += grossAmount
    day.aicGrossAmount += aicGrossAmount
    day.aicNetAmount += aicNetAmount
    day.discountAmount += discountAmount
    day.netAmount += netAmount

    model.totals.requests += requests
    model.totals.aicQuantity += aicQuantity
    model.totals.grossAmount += grossAmount
    model.totals.aicGrossAmount += aicGrossAmount
    model.totals.aicNetAmount += aicNetAmount
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
