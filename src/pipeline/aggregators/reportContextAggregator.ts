import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type ReportContextResult = {
  startDate: string | null
  endDate: string | null
}

export class ReportContextAggregator implements Aggregator<TokenUsageRecord, ReportContextResult, TokenUsageHeader> {
  private minDate: string | null = null
  private maxDate: string | null = null

  accumulate(record: TokenUsageRecord): void {
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
    }
  }
}
