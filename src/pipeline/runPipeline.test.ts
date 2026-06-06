import { describe, expect, it } from 'vitest'

import type { Aggregator } from './aggregators/base'
import { DailyUsageAggregator } from './aggregators/dailyUsageAggregator'
import { UserUsageAggregator } from './aggregators/userUsageAggregator'
import {
  InvalidReportError,
  UnsupportedNativeAiCreditsReportError,
  UnsupportedReportVersionError,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
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

const NATIVE_AI_CREDITS_HEADER = [
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
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
].join(',')

const NATIVE_AI_CREDITS_HEADER_WITHOUT_ALIASES = [
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
  'total_monthly_quota',
  'organization',
  'cost_center_name',
].join(',')

const TRANSITION_PERIOD_REPORT_METADATA = {
  format: 'transition-period-billing-preview',
  label: 'Transition Period Billing Preview report',
  supported: true,
}

const NATIVE_AI_CREDITS_REPORT_METADATA = {
  format: 'native-ai-credits',
  label: 'Native AI Credits report',
  supported: false,
} as const

function createCsv(rows: string[][], header = HEADER): File {
  const body = [header, ...rows.map((row) => row.join(','))].join('\n')
  return new File([body], 'usage.csv', { type: 'text/csv' })
}

class CaptureAggregator implements Aggregator<TokenUsageRecord, TokenUsageRecord[], TokenUsageHeader> {
  private readonly records: TokenUsageRecord[] = []
  private headerCallCount = 0

  onHeader(): void {
    this.headerCallCount += 1
  }

  accumulate(record: TokenUsageRecord): void {
    this.records.push(record)
  }

  result(): TokenUsageRecord[] {
    return this.records
  }

  headerCalls(): number {
    return this.headerCallCount
  }
}

describe('runPipeline', () => {
  it('rejects reports without a header row', async () => {
    const aggregator = new CaptureAggregator()
    const file = new File(['\n\n'], 'usage.csv', { type: 'text/csv' })

    await expect(runPipeline(file, [aggregator])).rejects.toThrow(InvalidReportError)
    expect(aggregator.result()).toEqual([])
  })

  it('returns transition-period metadata for a valid header-only report', async () => {
    const aggregator = new CaptureAggregator()

    await expect(runPipeline(createCsv([]), [aggregator])).resolves.toEqual({
      reportMetadata: TRANSITION_PERIOD_REPORT_METADATA,
      reportRowCount: 0,
      processedRowCount: 0,
    })
    expect(aggregator.result()).toEqual([])
  })

  it('rejects a malformed header-only report', async () => {
    const aggregator = new CaptureAggregator()

    await expect(runPipeline(createCsv([], 'foo,bar,baz'), [aggregator])).rejects.toThrow(InvalidReportError)
    expect(aggregator.result()).toEqual([])
  })

  it('rejects a pre-AIC header-only report', async () => {
    const header = [
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
    ].join(',')
    const aggregator = new CaptureAggregator()

    await expect(runPipeline(createCsv([], header), [aggregator])).rejects.toThrow(UnsupportedReportVersionError)
    expect(aggregator.result()).toEqual([])
  })

  it('rejects native AI Credits reports before aggregator calls', async () => {
    const file = createCsv([
      [
        '5/29/26',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '96.9990345',
        'ai-credits',
        '0.01',
        '0.969990345',
        '0',
        '0.969990345',
        '3900',
        'example-org',
        '',
        '96.9990345',
        '0.969990345',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    const aggregator = new CaptureAggregator()

    await expect(runPipeline(file, [aggregator])).rejects.toThrow(UnsupportedNativeAiCreditsReportError)
    expect(aggregator.headerCalls()).toBe(0)
    expect(aggregator.result()).toEqual([])
  })

  it('processes native AI Credits reports with native metadata when explicitly enabled', async () => {
    const file = createCsv([
      [
        '5/29/26',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '96.9990345',
        'ai-credits',
        '0.01',
        '0.969990345',
        '0',
        '0.969990345',
        '3900',
        'example-org',
        'Cost Center A',
        '999',
        '999',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    const aggregator = new CaptureAggregator()

    const result = await runPipeline(file, [aggregator], {
      enableNativeAiCreditsProcessing: true,
    })

    expect(result).toEqual({
      reportMetadata: NATIVE_AI_CREDITS_REPORT_METADATA,
      reportRowCount: 1,
      processedRowCount: 1,
    })
    expect(aggregator.headerCalls()).toBe(1)
    expect(aggregator.result()).toEqual([
      expect.objectContaining({
        date: '2026-05-29',
        username: 'mona',
        quantity: 96.9990345,
        gross_amount: 0.969990345,
        net_amount: 0.969990345,
        aic_quantity: 96.9990345,
        aic_gross_amount: 0.969990345,
        has_aic_quantity: true,
        has_aic_gross_amount: true,
      }),
    ])
  })

  it('aggregates flagged native AI Credits rows with native-format aggregators', async () => {
    const file = createCsv([
      [
        '5/29/26',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'GPT-5.2',
        '10',
        'ai-credits',
        '0.01',
        '100',
        '20',
        '80',
        '3900',
        'example-org',
        'Cost Center A',
        '999',
        '999',
      ],
      [
        '05/29/2026',
        'hubot',
        'spark',
        'spark_ai_credit',
        'GPT-5.2',
        '25',
        'ai-credits',
        '0.01',
        '250',
        '50',
        '200',
        '7000',
        'octodemo',
        'Cost Center A',
        '',
        '',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    const daily = new DailyUsageAggregator(NATIVE_AI_CREDITS_REPORT_METADATA)
    const users = new UserUsageAggregator(NATIVE_AI_CREDITS_REPORT_METADATA)

    await runPipeline(file, [daily, users], {
      enableNativeAiCreditsProcessing: true,
    })

    expect(daily.result().dailyData).toEqual([
      expect.objectContaining({
        date: '2026-05-29',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 35,
        aicGrossAmount: 350,
        aicNetAmount: 0,
      }),
    ])
    expect(users.result().users).toEqual([
      expect.objectContaining({
        username: 'hubot',
        totals: expect.objectContaining({
          requests: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
          aicQuantity: 25,
          aicGrossAmount: 250,
          aicNetAmount: 0,
        }),
      }),
      expect.objectContaining({
        username: 'mona',
        totals: expect.objectContaining({
          requests: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0,
          aicQuantity: 10,
          aicGrossAmount: 100,
          aicNetAmount: 0,
        }),
      }),
    ])
  })

  it('aggregates native quantity and gross amount columns when alias columns disagree', async () => {
    const file = createCsv([
      [
        '2026-06-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '42.726213',
        'ai-credits',
        '0.01',
        '0.4272621300000001',
        '0.4272621300000001',
        '0',
        '3900',
        'example-org',
        '',
        '999',
        '999',
      ],
      [
        '2026-09-01',
        'hubot',
        'copilot',
        'copilot_ai_credit',
        'Auto: GPT-5.3-Codex',
        '5.447169000000001',
        'ai-credits',
        '0.01',
        '0.054471689999999996',
        '0',
        '0.054471689999999996',
        '1900',
        'example-org',
        '',
        '888',
        '888',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    let daily!: DailyUsageAggregator

    await runPipeline(file, (reportMetadata) => {
      daily = new DailyUsageAggregator(reportMetadata)
      return [daily]
    }, {
      enableNativeAiCreditsProcessing: true,
    })

    expect(daily.result().dailyData).toEqual([
      expect.objectContaining({
        date: '2026-06-01',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 42.726213,
        aicGrossAmount: 0.4272621300000001,
        aicNetAmount: 0,
      }),
      expect.objectContaining({
        date: '2026-09-01',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 5.447169000000001,
        aicGrossAmount: 0.054471689999999996,
        aicNetAmount: 0,
      }),
    ])
  })

  it('processes native rows when alias columns are absent', async () => {
    const file = createCsv([
      [
        '2026-06-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '42.726213',
        'ai-credits',
        '0.01',
        '0.4272621300000001',
        '0.4272621300000001',
        '0',
        '3900',
        'example-org',
        '',
      ],
      [
        '2026-09-01',
        'hubot',
        'copilot',
        'copilot_ai_credit',
        'Auto: GPT-5.3-Codex',
        '5.447169000000001',
        'ai-credits',
        '0.01',
        '0.054471689999999996',
        '0',
        '0.054471689999999996',
        '1900',
        'example-org',
        '',
      ],
    ], NATIVE_AI_CREDITS_HEADER_WITHOUT_ALIASES)
    let daily!: DailyUsageAggregator

    const result = await runPipeline(file, (reportMetadata) => {
      daily = new DailyUsageAggregator(reportMetadata)
      return [daily]
    }, {
      enableNativeAiCreditsProcessing: true,
    })

    expect(result.reportMetadata).toEqual(NATIVE_AI_CREDITS_REPORT_METADATA)
    expect(daily.result().dailyData).toEqual([
      expect.objectContaining({
        date: '2026-06-01',
        aicQuantity: 42.726213,
        aicGrossAmount: 0.4272621300000001,
        aicNetAmount: 0,
      }),
      expect.objectContaining({
        date: '2026-09-01',
        aicQuantity: 5.447169000000001,
        aicGrossAmount: 0.054471689999999996,
        aicNetAmount: 0,
      }),
    ])
  })

  it('constructs aggregators after native report metadata is detected', async () => {
    const file = createCsv([
      [
        '5/29/26',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'GPT-5.2',
        '10',
        'ai-credits',
        '0.01',
        '100',
        '20',
        '80',
        '3900',
        'example-org',
        'Cost Center A',
        '999',
        '999',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    let daily!: DailyUsageAggregator
    let factoryMetadata: unknown = null

    const result = await runPipeline(file, (reportMetadata) => {
      factoryMetadata = reportMetadata
      daily = new DailyUsageAggregator(reportMetadata)
      return [daily]
    }, {
      enableNativeAiCreditsProcessing: true,
    })

    expect(factoryMetadata).toEqual(NATIVE_AI_CREDITS_REPORT_METADATA)
    expect(result.reportMetadata).toEqual(NATIVE_AI_CREDITS_REPORT_METADATA)
    expect(daily.result().dailyData).toEqual([
      expect.objectContaining({
        date: '2026-05-29',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 10,
        aicGrossAmount: 100,
        aicNetAmount: 0,
      }),
    ])
  })

  it('selects native summer and September included-credit policies for flagged native reports', async () => {
    const createNativePolicyCsv = (date: string) => createCsv([
      [
        date,
        'mona',
        'copilot',
        'copilot_ai_credit',
        'GPT-5.2',
        '5000',
        'ai-credits',
        '0.01',
        '50',
        '0',
        '50',
        '3900',
        'example-org',
        'Cost Center A',
        '5000',
        '50',
      ],
    ], NATIVE_AI_CREDITS_HEADER)
    const summerAggregator = new CaptureAggregator()
    const septemberAggregator = new CaptureAggregator()

    await runPipeline(createNativePolicyCsv('8/31/26'), [summerAggregator], {
      enableNativeAiCreditsProcessing: true,
    })
    await runPipeline(createNativePolicyCsv('9/1/26'), [septemberAggregator], {
      enableNativeAiCreditsProcessing: true,
    })

    expect(summerAggregator.result()[0]).toEqual(expect.objectContaining({
      date: '2026-08-31',
      aic_net_amount: 0,
    }))
    expect(septemberAggregator.result()[0]).toEqual(expect.objectContaining({
      date: '2026-09-01',
    }))
    expect(septemberAggregator.result()[0].aic_net_amount).toBeCloseTo(11)
  })

  it('returns transition-period metadata while processing supported reports', async () => {
    const file = createCsv([
      ['2026-04-25', 'mona', 'copilot', 'copilot_premium_request', 'GPT-5', '0', 'requests', '0.04', '0', '0', '0', 'False', '300', '', '', '0', '0'],
      ['2026-04-25', 'mona', 'copilot', 'copilot_premium_request', 'GPT-5', '10', 'requests', '0.04', '0.40', '0', '0.40', 'False', '0', '', '', '100', '1.00'],
    ])
    const aggregator = new CaptureAggregator()

    const result = await runPipeline(file, [aggregator])

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
    expect(result).toEqual({
      reportMetadata: TRANSITION_PERIOD_REPORT_METADATA,
      reportRowCount: 2,
      processedRowCount: 1,
    })
  })

  it('keeps transition-period allocation for supported reports after the native policy boundary', async () => {
    const file = createCsv([
      ['2026-09-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '3000', 'ai-credits', '0.01', '30.00', '0', '30.00', 'False', '300', 'example-org', 'Cost Center A', '3000', '30.00'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator])

    expect(aggregator.result()).toEqual([
      expect.objectContaining({
        username: 'mona',
        total_monthly_quota: 300,
        aic_net_amount: 0,
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
