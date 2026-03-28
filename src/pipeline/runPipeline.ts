import type { Aggregator } from './aggregators/base'
import { calculateAicEntitlementPool, PooledAicEntitlementAllocator } from './aicEntitlements'
import { parseTokenUsageHeader, parseTokenUsageRecord, type TokenUsageHeader, type TokenUsageRecord } from './parser'
import { streamLines } from './streamer'

export interface PipelineProgress {
  rowsProcessed: number
}

export interface PipelineOptions {
  progressResolution?: number
  onProgress?: (progress: PipelineProgress) => void
}

export async function runPipeline(
  file: File,
  aggregators: Aggregator<TokenUsageRecord, unknown, TokenUsageHeader>[],
  options?: PipelineOptions,
): Promise<void> {
  const { progressResolution = 500, onProgress } = options ?? {}
  const totalAicEntitlements = await calculateAicEntitlementPool(file)
  const aicEntitlementAllocator = new PooledAicEntitlementAllocator(totalAicEntitlements)
  let header: TokenUsageHeader | null = null
  let rowIndex = 0
  let lastEmittedRows = 0

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      const parsedHeader = parseTokenUsageHeader(trimmed)
      header = parsedHeader
      aggregators.forEach((aggregator) => aggregator.onHeader?.(parsedHeader))
      continue
    }

    const record = aicEntitlementAllocator.apply(parseTokenUsageRecord(trimmed, header))
    aggregators.forEach((aggregator) => aggregator.accumulate(record, rowIndex))
    rowIndex += 1

    if (onProgress && progressResolution > 0 && rowIndex % progressResolution === 0) {
      onProgress({ rowsProcessed: rowIndex })
      lastEmittedRows = rowIndex
    }
  }

  if (onProgress && progressResolution > 0 && rowIndex > lastEmittedRows) {
    onProgress({ rowsProcessed: rowIndex })
  }
}
