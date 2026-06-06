import type { Aggregator } from './aggregators/base'
import { createAicIncludedCreditsAllocator, type AicIncludedCreditsOverrides } from './aicIncludedCredits'
import {
  InvalidReportError,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import {
  validateUsageReportFirstRecord,
  validateUsageReportHeader,
  type ReportFormatMetadata,
  type UsageReportAdapter,
  type UsageReportValidationOptions,
} from './reportAdapters'
import { streamLines, type StreamProgress } from './streamer'

async function validateFileFormat(file: File, options?: UsageReportValidationOptions): Promise<UsageReportAdapter> {
  let header: TokenUsageHeader | null = null
  let selectedAdapter: UsageReportAdapter | null = null

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) {
      continue
    }

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      selectedAdapter = validateUsageReportHeader(header)
      continue
    }

    return validateUsageReportFirstRecord(header, parseTokenUsageRecord(trimmed, header), options)
  }

  if (!selectedAdapter) {
    throw new InvalidReportError()
  }

  return selectedAdapter
}

export interface PipelineProgress {
  stage: 'analyzing' | 'processing'
  rowsProcessed: number
  bytesProcessed: number
  totalBytes: number
  progressPercent: number
}

export interface PipelineOptions {
  enableNativeAiCreditsProcessing?: boolean
  includedCreditsOverrides?: AicIncludedCreditsOverrides
  progressResolution?: number
  onProgress?: (progress: PipelineProgress) => void
}

export interface PipelineResult {
  reportMetadata: ReportFormatMetadata
  reportRowCount: number
  processedRowCount: number
}

export type PipelineAggregators =
  | Aggregator<TokenUsageRecord, unknown, TokenUsageHeader>[]
  | ((reportMetadata: ReportFormatMetadata) => Aggregator<TokenUsageRecord, unknown, TokenUsageHeader>[])

const ANALYSIS_PROGRESS_WEIGHT = 0.4
const MIN_PROGRESS_INCREMENT_PERCENT = 1
const MIN_PROGRESS_EMIT_INTERVAL_MS = 80
const MIN_YIELD_INTERVAL_MS = 80

function getProgressRatio({ bytesProcessed, totalBytes }: StreamProgress): number {
  if (totalBytes <= 0) {
    return 1
  }

  return Math.min(bytesProcessed / totalBytes, 1)
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function getNow(): number {
  return globalThis.performance?.now() ?? Date.now()
}

export async function runPipeline(
  file: File,
  aggregatorsOrFactory: PipelineAggregators,
  options?: PipelineOptions,
): Promise<PipelineResult> {
  const {
    enableNativeAiCreditsProcessing = false,
    includedCreditsOverrides = {},
    progressResolution = 500,
    onProgress,
  } = options ?? {}
  const reportAdapter = await validateFileFormat(file, {
    allowUnsupportedNativeAiCredits: enableNativeAiCreditsProcessing,
  })
  const reportMetadata = reportAdapter.metadata
  const aggregators = typeof aggregatorsOrFactory === 'function'
    ? aggregatorsOrFactory(reportMetadata)
    : aggregatorsOrFactory
  let lastProgressStage: PipelineProgress['stage'] | null = null
  let lastProgressPercent = -1
  let lastProgressTimestamp = 0
  let lastYieldTimestamp = 0
  const emitProgress = (
    stage: PipelineProgress['stage'],
    rowsProcessed: number,
    streamProgress: StreamProgress,
    force = false,
  ) => {
    if (!onProgress) {
      return false
    }

    const stageRatio = getProgressRatio(streamProgress)
    const weightedRatio = stage === 'analyzing'
      ? stageRatio * ANALYSIS_PROGRESS_WEIGHT
      : ANALYSIS_PROGRESS_WEIGHT + (stageRatio * (1 - ANALYSIS_PROGRESS_WEIGHT))
    const unclampedProgressPercent = Math.round(Math.min(weightedRatio * 100, 100))
    const progressPercent = stage === 'processing' && !force
      ? Math.min(unclampedProgressPercent, 99)
      : unclampedProgressPercent
    const now = getNow()
    const stageChanged = stage !== lastProgressStage
    const percentAdvanced = progressPercent >= lastProgressPercent + MIN_PROGRESS_INCREMENT_PERCENT
    const intervalElapsed = now - lastProgressTimestamp >= MIN_PROGRESS_EMIT_INTERVAL_MS

    if (!force && !stageChanged && !percentAdvanced && !intervalElapsed) {
      return false
    }

    onProgress({
      stage,
      rowsProcessed,
      bytesProcessed: streamProgress.bytesProcessed,
      totalBytes: streamProgress.totalBytes,
      progressPercent,
    })

    lastProgressStage = stage
    lastProgressPercent = progressPercent
    lastProgressTimestamp = now
    return true
  }

  const aicIncludedCreditAllocator = await createAicIncludedCreditsAllocator(file, includedCreditsOverrides, {
    reportMetadata,
    onProgress: (streamProgress) => {
      emitProgress('analyzing', 0, streamProgress)
    },
  })
  let header: TokenUsageHeader | null = null
  let reportRowCount = 0
  let rowIndex = 0
  let latestStreamProgress: StreamProgress = {
    bytesProcessed: 0,
    totalBytes: file.size,
  }

  for await (const line of streamLines(file, {
    onProgress: (streamProgress) => {
      latestStreamProgress = streamProgress
      emitProgress('processing', rowIndex, streamProgress)
    },
  })) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      aggregators.forEach((aggregator) => aggregator.onHeader?.(header!))
      continue
    }

    const normalizedRecord = reportAdapter.parseRecord(trimmed, header)
    reportRowCount += 1
    if (!normalizedRecord) continue

    const record = aicIncludedCreditAllocator.apply(normalizedRecord)
    aggregators.forEach((aggregator) => aggregator.accumulate(record, rowIndex))
    rowIndex += 1

    if (onProgress && progressResolution > 0 && rowIndex % progressResolution === 0) {
      emitProgress('processing', rowIndex, latestStreamProgress)

      const now = getNow()
      if (now - lastYieldTimestamp >= MIN_YIELD_INTERVAL_MS) {
        lastYieldTimestamp = now
        await yieldToBrowser()
      }
    }
  }

  if (onProgress) {
    emitProgress('processing', rowIndex, {
      bytesProcessed: file.size,
      totalBytes: file.size,
    }, true)
  }

  return {
    reportMetadata,
    reportRowCount,
    processedRowCount: rowIndex,
  }
}
