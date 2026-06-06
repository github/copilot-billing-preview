import { describe, expect, it } from 'vitest'

import {
  parseNativeAiCreditsUsageRecord,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
  type TokenUsageRecord,
} from './parser'
import { getReportUsageMetrics, type CanonicalAiCreditsMetrics } from './reportUsageMetrics'
import type { ReportFormatMetadata } from './reportAdapters'

const TRANSITION_PERIOD_HEADER = [
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

const TRANSITION_PERIOD_METADATA: ReportFormatMetadata = {
  format: 'transition-period-billing-preview',
  label: 'Transition Period Billing Preview report',
  supported: true,
}

function buildRow(values: string[]): string {
  return values.join(',')
}

function sumAiCredits(metrics: CanonicalAiCreditsMetrics[]): CanonicalAiCreditsMetrics {
  return metrics.reduce<CanonicalAiCreditsMetrics>((total, metric) => ({
    quantity: total.quantity + metric.quantity,
    grossAmount: total.grossAmount + metric.grossAmount,
    discountAmount: total.discountAmount + metric.discountAmount,
    netAmount: total.netAmount + metric.netAmount,
  }), {
    quantity: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  })
}

describe('getReportUsageMetrics', () => {
  it('preserves transition-period PRU comparison and AIC metrics for request rows', () => {
    const header = parseTokenUsageHeader(TRANSITION_PERIOD_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Auto: Claude Haiku 4.5',
        '2.5',
        'requests',
        '0.04',
        '0.10',
        '0.03',
        '0.07',
        'False',
        '300',
        'example-org',
        'Cost Center A',
        '1.5',
        '0.015',
      ]),
      header,
    )

    expect(getReportUsageMetrics(record, TRANSITION_PERIOD_METADATA)).toEqual({
      aiCredits: {
        quantity: 1.5,
        grossAmount: 0.015,
        discountAmount: 0,
        netAmount: 0.015,
      },
      transitionPeriodComparison: {
        requests: 2.5,
        grossAmount: 0.1,
        discountAmount: 0.03,
        netAmount: 0.07,
      },
    })
  })

  it('preserves transition-period AI Credits row semantics and PRU comparison zeros', () => {
    const header = parseTokenUsageHeader(TRANSITION_PERIOD_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '50',
        'ai-credits',
        '0.01',
        '0.50',
        '0.10',
        '0.40',
        'False',
        '300',
        'example-org',
        'Cost Center A',
        '',
        '',
      ]),
      header,
    )

    expect(getReportUsageMetrics(record, 'transition-period-billing-preview')).toEqual({
      aiCredits: {
        quantity: 50,
        grossAmount: 0.5,
        discountAmount: 0,
        netAmount: 0.5,
      },
      transitionPeriodComparison: {
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
      },
    })
  })

  it('uses native AI Credits quantity and cost fields as actual AIC metrics with no PRU comparison', () => {
    const header = parseTokenUsageHeader(NATIVE_AI_CREDITS_HEADER)
    const records = [
      parseNativeAiCreditsUsageRecord(
        buildRow([
          '5/29/26',
          'hubot',
          'spark',
          'spark_ai_credit',
          'GPT-5.2',
          '12.5',
          'ai-credits',
          '0.01',
          '0.125',
          '0.025',
          '0.1',
          '7000',
          'octodemo',
          '',
          '',
          '',
        ]),
        header,
      ),
      parseNativeAiCreditsUsageRecord(
        buildRow([
          '5/30/26',
          'octocat',
          'copilot',
          'copilot_ai_credit',
          'GPT-5.2',
          '50',
          'ai-credits',
          '0.01',
          '0.50',
          '0.20',
          '0.30',
          '3900',
          'example-org',
          'Cost Center A',
          '75',
          '0.75',
        ]),
        header,
      ),
    ]
    const metrics = records.map((record) => getReportUsageMetrics(record, 'native-ai-credits'))

    expect(metrics.every((metric) => metric.transitionPeriodComparison === null)).toBe(true)
    expect(sumAiCredits(metrics.map((metric) => metric.aiCredits))).toEqual({
      quantity: 62.5,
      grossAmount: 0.625,
      discountAmount: 0.225,
      netAmount: 0.4,
    })
  })

  it('uses native-normalized AIC fields so included-credit allocation changes are reflected', () => {
    const header = parseTokenUsageHeader(NATIVE_AI_CREDITS_HEADER)
    const row = buildRow([
      '5/29/26',
      'hubot',
      'spark',
      'spark_ai_credit',
      'GPT-5.2',
      '12.5',
      'ai-credits',
      '0.01',
      '0.125',
      '0.025',
      '0.1',
      '7000',
      'octodemo',
      '',
      '',
      '',
    ])
    const nativeRecord = parseNativeAiCreditsUsageRecord(row, header)
    nativeRecord.aic_net_amount = 0.02

    expect(getReportUsageMetrics(nativeRecord, 'native-ai-credits')).toMatchObject({
      aiCredits: {
        quantity: 12.5,
        grossAmount: 0.125,
        discountAmount: 0.105,
        netAmount: 0.02,
      },
      transitionPeriodComparison: null,
    })
  })

  it('derives transition-period AIC discount from current AIC gross and net semantics', () => {
    const record: TokenUsageRecord = {
      date: '2026-05-29',
      username: 'mona',
      product: 'copilot',
      sku: 'copilot_premium_request',
      model: 'GPT-5.2',
      quantity: 2,
      unit_type: 'requests',
      applied_cost_per_quantity: 0.04,
      gross_amount: 0.08,
      discount_amount: 0,
      net_amount: 0.08,
      exceeds_quota: false,
      total_monthly_quota: 300,
      organization: 'example-org',
      cost_center_name: 'Cost Center A',
      aic_quantity: 8,
      aic_gross_amount: 0.08,
      aic_net_amount: 0.03,
      has_aic_quantity: true,
      has_aic_gross_amount: true,
    }

    expect(getReportUsageMetrics(record, 'transition-period-billing-preview').aiCredits).toEqual({
      quantity: 8,
      grossAmount: 0.08,
      discountAmount: 0.05,
      netAmount: 0.03,
    })
  })
})
