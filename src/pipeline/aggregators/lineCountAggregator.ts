import type { Aggregator } from './base'
import type { TokenUsageHeader, TokenUsageRecord } from '../parser'

export type LineCountResult = {
  lineCount: number
}

export class LineCountAggregator implements Aggregator<TokenUsageRecord, LineCountResult, TokenUsageHeader> {
  private count = 0

  onHeader(): void {
    // header is intentionally ignored for the line count
  }

  accumulate(): void {
    this.count += 1
  }

  result(): LineCountResult {
    return { lineCount: this.count }
  }
}
