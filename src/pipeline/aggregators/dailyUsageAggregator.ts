import type { Aggregator } from './base'
import { getUsageMetrics, type TokenUsageRecord } from '../parser'

export interface DailyUsageData {
  date: string
  requests: number
  aicQuantity: number
  grossAmount: number
  aicGrossAmount: number
  aicNetAmount: number
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

    const { requests, aicQuantity, grossAmount, aicGrossAmount, aicNetAmount, discountAmount, netAmount } = getUsageMetrics(record)

    if (existing) {
      existing.requests += requests
      existing.aicQuantity += aicQuantity
      existing.grossAmount += grossAmount
      existing.aicGrossAmount += aicGrossAmount
      existing.aicNetAmount += aicNetAmount
      existing.discountAmount += discountAmount
      existing.netAmount += netAmount
      return
    }

    this.dataByDate.set(date, {
      date,
      requests,
      aicQuantity,
      grossAmount,
      aicGrossAmount,
      aicNetAmount,
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
