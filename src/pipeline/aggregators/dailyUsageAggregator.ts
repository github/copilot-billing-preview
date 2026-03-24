import type { Aggregator } from './base'
import type { TokenUsageRecord } from '../parser'

export interface DailyUsageData {
  date: string
  requests: number
  aiuQuantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export interface DailyUsageResult {
  dailyData: DailyUsageData[]
}

export class DailyUsageAggregator implements Aggregator<TokenUsageRecord, DailyUsageResult> {
  private dataByDate = new Map<string, DailyUsageData>()

  accumulate(record: TokenUsageRecord): void {
    const date = record.date ?? ''
    if (!date) return

    const existing = this.dataByDate.get(date)

    const requests = record.quantity || 0
    const aiuQuantity = record.aiu_quantity || 0
    const grossAmount = record.gross_amount || 0
    const discountAmount = record.discount_amount || 0
    const netAmount = record.net_amount || 0

    if (existing) {
      existing.requests += requests
      existing.aiuQuantity += aiuQuantity
      existing.grossAmount += grossAmount
      existing.discountAmount += discountAmount
      existing.netAmount += netAmount
      return
    }

    this.dataByDate.set(date, {
      date,
      requests,
      aiuQuantity,
      grossAmount,
      discountAmount,
      netAmount,
    })
  }

  result(): DailyUsageResult {
    const sortedDates = Array.from(this.dataByDate.keys()).sort()
    const dailyData = sortedDates.map((date) => this.dataByDate.get(date)!)
    return { dailyData }
  }
}
