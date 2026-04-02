import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageHeader, type TokenUsageRecord } from '../parser'

export type ProductUsageTotals = {
  requests: number
  aicQuantity: number
  grossAmount: number
  netAmount: number
  aicGrossAmount: number
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
    aicQuantity: 0,
    grossAmount: 0,
    netAmount: 0,
    aicGrossAmount: 0,
    aicNetAmount: 0,
  }
}

function getFriendlyProductName(record: TokenUsageRecord): string {
  const product = record.product.trim().toLowerCase()
  const sku = record.sku.trim().toLowerCase()
  const model = record.model.trim()

  if (product === 'spark' || sku.startsWith('spark_')) return 'Spark'
  if (model === 'Code Review model') return 'Code Review'
  if (model === 'Coding Agent model') return 'Copilot Cloud Agent'
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

    const { requests, aicQuantity, grossAmount, netAmount, aicGrossAmount, aicNetAmount } = getUsageMetrics(record)
    productUsage.totals.requests += requests
    productUsage.totals.aicQuantity += aicQuantity
    productUsage.totals.grossAmount += grossAmount
    productUsage.totals.netAmount += netAmount
    productUsage.totals.aicGrossAmount += aicGrossAmount
    productUsage.totals.aicNetAmount += aicNetAmount

    let modelTotals = productUsage.models.get(model)
    if (!modelTotals) {
      modelTotals = createTotals()
      productUsage.models.set(model, modelTotals)
    }

    modelTotals.requests += requests
    modelTotals.aicQuantity += aicQuantity
    modelTotals.grossAmount += grossAmount
    modelTotals.netAmount += netAmount
    modelTotals.aicGrossAmount += aicGrossAmount
    modelTotals.aicNetAmount += aicNetAmount
  }

  result(): ProductUsageResult {
    const products = Array.from(this.byProduct.entries())
      .map<ProductUsage>(([product, usage]) => ({
        product,
        totals: usage.totals,
        models: Object.fromEntries(
          Array.from(usage.models.entries()).sort((a, b) => b[1].netAmount - a[1].netAmount),
        ),
      }))
      .sort((a, b) => b.totals.netAmount - a.totals.netAmount)

    return { products }
  }
}
