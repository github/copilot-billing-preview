import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type ReportContextResult = {
  startDate: string | null
  endDate: string | null
  products: string[]
  skus: string[]
  unitTypes: string[]
}

export class ReportContextAggregator implements Aggregator<TokenUsageRecord, ReportContextResult, TokenUsageHeader> {
  private minDate: string | null = null
  private maxDate: string | null = null
  private readonly products = new Set<string>()
  private readonly skus = new Set<string>()
  private readonly unitTypes = new Set<string>()

  accumulate(record: TokenUsageRecord): void {
    if (record.product) {
      this.products.add(record.product)
    }
    if (record.sku) {
      this.skus.add(record.sku)
    }
    if (record.unit_type) {
      this.unitTypes.add(record.unit_type)
    }

    const isoDate = record.date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return

    // Keep raw ISO date strings to avoid timezone mutations.
    if (!this.minDate || isoDate < this.minDate) {
      this.minDate = isoDate
    }
    if (!this.maxDate || isoDate > this.maxDate) {
      this.maxDate = isoDate
    }
  }

  result(): ReportContextResult {
    return {
      startDate: this.minDate,
      endDate: this.maxDate,
      products: [...this.products].sort(),
      skus: [...this.skus].sort(),
      unitTypes: [...this.unitTypes].sort(),
    }
  }
}
