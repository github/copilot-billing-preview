import type { Aggregator } from './aggregators/base'
import { parseCsvLine, type ParsedRow } from './parser'
import { streamLines } from './streamer'

export async function runPipeline(
  file: File,
  aggregators: Aggregator<ParsedRow, unknown>[],
): Promise<void> {
  let isHeader = true
  let rowIndex = 0

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    const parsed = parseCsvLine(trimmed)

    if (isHeader) {
      isHeader = false
      aggregators.forEach((aggregator) => aggregator.onHeader?.(parsed))
      continue
    }

    aggregators.forEach((aggregator) => aggregator.accumulate(parsed, rowIndex))
    rowIndex += 1
  }
}
