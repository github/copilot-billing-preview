import { describe, expect, it } from 'vitest'

import type { Aggregator } from './aggregators/base'
import type { TokenUsageHeader, TokenUsageRecord } from './parser'
import { runPipeline } from './runPipeline'

const HEADER = [
  'date',
  'username',
  'product',
  'sku',
  'model',
  'quantity',
  'unit_type',
  'applied_cost_per_quantity',
  'gross_amount',
  'discount_amount',
  'net_amount',
  'exceeds_quota',
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
].join(',')

function createCsv(rows: string[][]): File {
  const body = [HEADER, ...rows.map((row) => row.join(','))].join('\n')
  return new File([body], 'usage.csv', { type: 'text/csv' })
}

class CaptureAggregator implements Aggregator<TokenUsageRecord, TokenUsageRecord[], TokenUsageHeader> {
  private readonly records: TokenUsageRecord[] = []

  onHeader(): void {
    // no-op
  }

  accumulate(record: TokenUsageRecord): void {
    this.records.push(record)
  }

  result(): TokenUsageRecord[] {
    return this.records
  }
}

describe('runPipeline progress', () => {
  it('filters and normalizes known normalization window rows before AIC allocation', async () => {
    const file = createCsv([
      ['2026-04-25', 'mona', 'copilot', 'copilot_premium_request', 'GPT-5', '0', 'requests', '0.04', '0', '0', '0', 'False', '300', '', '', '0', '0'],
      ['2026-04-25', 'mona', 'copilot', 'copilot_premium_request', 'GPT-5', '10', 'requests', '0.04', '0.40', '0', '0.40', 'False', '0', '', '', '100', '1.00'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator])

    expect(aggregator.result()).toEqual([
      expect.objectContaining({
        username: 'mona',
        quantity: 0,
        total_monthly_quota: 0,
        aic_quantity: 50,
        aic_gross_amount: 0.5,
        aic_net_amount: 0.5,
      }),
    ])
  })

  it('emits weighted progress for analysis and processing stages', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cost Center A', '10', '0.10'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '20', 'ai-credits', '0.01', '0.20', '0', '0.20', 'False', '300', 'octo', 'Cost Center A', '20', '0.20'],
      ['2026-03-03', 'octocat', 'copilot', 'copilot_ai_credit', 'GPT-5', '30', 'ai-credits', '0.01', '0.30', '0', '0.30', 'False', '300', 'octo', 'Cost Center B', '30', '0.30'],
    ])
    const aggregator = new CaptureAggregator()
    const progressEvents: Array<{
      stage: 'analyzing' | 'processing'
      rowsProcessed: number
      bytesProcessed: number
      totalBytes: number
      progressPercent: number
    }> = []

    await runPipeline(file, [aggregator], {
      progressResolution: 1,
      onProgress: (progress) => {
        progressEvents.push(progress)
      },
    })

    expect(aggregator.result()).toHaveLength(3)
    expect(progressEvents.some((progress) => (
      progress.stage === 'analyzing'
      && progress.progressPercent > 0
      && progress.progressPercent <= 40
    ))).toBe(true)
    expect(progressEvents.some((progress) => (
      progress.stage === 'processing'
      && progress.progressPercent >= 40
      && progress.progressPercent < 100
    ))).toBe(true)
    expect(progressEvents.at(-1)).toEqual({
      stage: 'processing',
      rowsProcessed: 3,
      bytesProcessed: file.size,
      totalBytes: file.size,
      progressPercent: 100,
    })
  })

  it('emits processing progress with consumed bytes before completion', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cost Center A', '10', '0.10'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '20', 'ai-credits', '0.01', '0.20', '0', '0.20', 'False', '300', 'octo', 'Cost Center A', '20', '0.20'],
    ])
    const aggregator = new CaptureAggregator()
    const progressEvents: Array<{
      stage: 'analyzing' | 'processing'
      rowsProcessed: number
      bytesProcessed: number
      totalBytes: number
      progressPercent: number
    }> = []

    await runPipeline(file, [aggregator], {
      progressResolution: 1,
      onProgress: (progress) => {
        progressEvents.push(progress)
      },
    })

    const processingEvents = progressEvents.filter((progress) => progress.stage === 'processing')
    const firstRowProgress = processingEvents.find((progress) => progress.rowsProcessed > 0)

    expect(firstRowProgress?.bytesProcessed).toBeGreaterThan(0)
    expect(processingEvents.slice(0, -1).every((progress) => progress.progressPercent < 100)).toBe(true)
    expect(processingEvents.at(-1)).toEqual({
      stage: 'processing',
      rowsProcessed: 2,
      bytesProcessed: file.size,
      totalBytes: file.size,
      progressPercent: 100,
    })
  })
})
