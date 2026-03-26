import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'

export type ProductUsageTotals = {
  requests: number
  aiuQuantity: number
  grossAmount: number
  aiuGrossAmount: number
  aicNetAmount: number
}

export type ProductUsage = {
  product: string
  totals: ProductUsageTotals
  models: Record<string, ProductUsageTotals>
}

export type ProductUsageResult = {
  products: ProductUsage[]
}

function createTotals(): ProductUsageTotals {
  return {
    requests: 0,
    aiuQuantity: 0,
    grossAmount: 0,
    aiuGrossAmount: 0,
    aicNetAmount: 0,
  }
}

function getFriendlyProductName(record: TokenUsageRecord): string {
  const model = record.model.trim()

  if (model === 'Code Review model') return 'Code Review'
  if (model === 'Coding Agent model') return 'Coding Agent'
  return 'Copilot'
}

export class ProductUsageAggregator implements Aggregator<TokenUsageRecord, ProductUsageResult, TokenUsageHeader> {
  private readonly byProduct = new Map<string, { totals: ProductUsageTotals; models: Map<string, ProductUsageTotals> }>()

  onHeader(): void {
    // header is intentionally ignored (we rely on parsed TokenUsageRecord fields)
  }

  accumulate(record: TokenUsageRecord): void {
    const product = getFriendlyProductName(record)
    const model = record.model.trim() || 'Unknown'

    let productUsage = this.byProduct.get(product)
    if (!productUsage) {
      productUsage = {
        totals: createTotals(),
        models: new Map(),
      }
      this.byProduct.set(product, productUsage)
    }

    const { requests, aiuQuantity, grossAmount, aiuGrossAmount, aicNetAmount } = getUsageMetrics(record)
    productUsage.totals.requests += requests
    productUsage.totals.aiuQuantity += aiuQuantity
    productUsage.totals.grossAmount += grossAmount
    productUsage.totals.aiuGrossAmount += aiuGrossAmount
    productUsage.totals.aicNetAmount += aicNetAmount

    let modelTotals = productUsage.models.get(model)
    if (!modelTotals) {
      modelTotals = createTotals()
      productUsage.models.set(model, modelTotals)
    }

    modelTotals.requests += requests
    modelTotals.aiuQuantity += aiuQuantity
    modelTotals.grossAmount += grossAmount
    modelTotals.aiuGrossAmount += aiuGrossAmount
    modelTotals.aicNetAmount += aicNetAmount
  }

  result(): ProductUsageResult {
    const products = Array.from(this.byProduct.entries())
      .map<ProductUsage>(([product, usage]) => ({
        product,
        totals: usage.totals,
        models: Object.fromEntries(
          Array.from(usage.models.entries()).sort((a, b) => b[1].grossAmount - a[1].grossAmount),
        ),
      }))
      .sort((a, b) => b.totals.grossAmount - a.totals.grossAmount)

    return { products }
  }
}