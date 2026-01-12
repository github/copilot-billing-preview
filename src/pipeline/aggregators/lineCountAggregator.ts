import type { Aggregator } from './base'

export type LineCountResult = {
  lineCount: number
}

export class LineCountAggregator implements Aggregator<string[], LineCountResult> {
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
