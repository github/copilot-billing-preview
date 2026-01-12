import type { Aggregator } from './aggregators/base'
import { parseTokenUsageHeader, parseTokenUsageRecord, type TokenUsageHeader, type TokenUsageRecord } from './parser'
import { streamLines } from './streamer'

export async function runPipeline(
  file: File,
  aggregators: Aggregator<TokenUsageRecord, unknown, TokenUsageHeader>[],
): Promise<void> {
  let header: TokenUsageHeader | null = null
  let rowIndex = 0

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      const parsedHeader = parseTokenUsageHeader(trimmed)
      header = parsedHeader
      aggregators.forEach((aggregator) => aggregator.onHeader?.(parsedHeader))
      continue
    }

    const record = parseTokenUsageRecord(trimmed, header)
    aggregators.forEach((aggregator) => aggregator.accumulate(record, rowIndex))
    rowIndex += 1
  }
}
