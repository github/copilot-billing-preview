import type { Aggregator } from './base'
import type { TokenUsageRecord } from '../parser'

export interface DailyTokenData {
  date: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
}

export interface DailyTokenResult {
  dailyData: DailyTokenData[]
}

export class DailyTokenAggregator implements Aggregator<TokenUsageRecord, DailyTokenResult> {
  private dataByDate = new Map<string, DailyTokenData>()

  accumulate(record: TokenUsageRecord): void {
    const date = record.date ?? ''
    if (!date) return

    const existing = this.dataByDate.get(date)

    const inputTokens = record.total_input_tokens || 0
    const outputTokens = record.total_output_tokens || 0
    const cacheCreationTokens = record.total_cache_creation_tokens || 0
    const cacheReadTokens = record.total_cache_read_tokens || 0

    if (existing) {
      existing.totalInputTokens += inputTokens
      existing.totalOutputTokens += outputTokens
      existing.totalCacheCreationTokens += cacheCreationTokens
      existing.totalCacheReadTokens += cacheReadTokens
    } else {
      this.dataByDate.set(date, {
        date,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalCacheCreationTokens: cacheCreationTokens,
        totalCacheReadTokens: cacheReadTokens,
      })
    }
  }

  result(): DailyTokenResult {
    // Sort by date ascending
    const sortedDates = Array.from(this.dataByDate.keys()).sort()
    const dailyData = sortedDates.map((date) => this.dataByDate.get(date)!)

    return { dailyData }
  }
}
