import { describe, expect, it } from 'vitest'

import {
  InvalidReportError,
  UnsupportedNativeAiCreditsReportError,
  UnsupportedReportVersionError,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
} from './parser'
import {
  detectReportFormat,
  selectUsageReportAdapter,
  validateUsageReportFirstRecord,
  validateUsageReportHeader,
} from './reportAdapters'

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

const HEADER_WITHOUT_EXCEEDS_QUOTA = [
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

function buildRow(values: string[]): string {
  return values.join(',')
}

describe('usage report adapters', () => {
  it('detects and selects the Transition Period Billing Preview adapter for current preview reports', () => {
    const header = parseTokenUsageHeader(TRANSITION_PERIOD_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Auto: Claude Haiku 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0',
        '0.08',
        'False',
        '300',
        'example-org',
        'Cost Center A',
        '20',
        '0.20',
      ]),
      header,
    )

    expect(detectReportFormat(header, record)).toBe('transition-period-billing-preview')
    expect(selectUsageReportAdapter(header, record).metadata).toMatchObject({
      format: 'transition-period-billing-preview',
      supported: true,
    })
    expect(() => validateUsageReportFirstRecord(header, record)).not.toThrow()
  })

  it('keeps missing-exceeds premium request rows on the Transition Period Billing Preview adapter', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Auto: Claude Haiku 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0',
        '0.08',
        '300',
        'example-org',
        'Cost Center A',
        '20',
        '0.20',
      ]),
      header,
    )

    expect(detectReportFormat(header, record)).toBe('transition-period-billing-preview')
    expect(selectUsageReportAdapter(header, record).metadata.format).toBe('transition-period-billing-preview')
    expect(() => validateUsageReportFirstRecord(header, record)).not.toThrow()
  })

  it('normalizes transition-period rows through the adapter parser', () => {
    const header = parseTokenUsageHeader(TRANSITION_PERIOD_HEADER)
    const adapter = validateUsageReportHeader(header)

    expect(adapter.parseRecord(
      buildRow([
        '2026-04-25',
        'mona',
        'copilot',
        'copilot_premium_request',
        'GPT-5',
        '0',
        'requests',
        '0.04',
        '0',
        '0',
        '0',
        'False',
        '300',
        '',
        '',
        '0',
        '0',
      ]),
      header,
    )).toBeNull()

    expect(adapter.parseRecord(
      buildRow([
        '2026-04-25',
        'mona',
        'copilot',
        'copilot_premium_request',
        'GPT-5',
        '10',
        'requests',
        '0.04',
        '0.40',
        '0',
        '0.40',
        'False',
        '0',
        '',
        '',
        '100',
        '1.00',
      ]),
      header,
    )).toMatchObject({
      username: 'mona',
      quantity: 0,
      gross_amount: 0,
      net_amount: 0,
      aic_quantity: 50,
      aic_gross_amount: 0.5,
      aic_net_amount: 0.5,
    })
  })

  it('detects native AI Credits reports and routes them to an unsupported adapter', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    const row = buildRow([
      '2026-06-01',
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
    ])
    const record = parseTokenUsageRecord(
      row,
      header,
    )

    const adapter = selectUsageReportAdapter(header, record)

    expect(detectReportFormat(header, record)).toBe('native-ai-credits')
    expect(adapter.metadata).toMatchObject({
      format: 'native-ai-credits',
      supported: false,
    })

    expect(() => adapter.validateFirstRecord(header, record)).toThrow(UnsupportedNativeAiCreditsReportError)
    expect(() => validateUsageReportFirstRecord(header, record)).toThrow(UnsupportedNativeAiCreditsReportError)
    expect(adapter.parseRecord(row, header)).toMatchObject({
      date: '2026-06-01',
      quantity: 96.9990345,
      unit_type: 'ai-credits',
      aic_quantity: 96.9990345,
      aic_gross_amount: 0.969990345,
      aic_net_amount: 0.969990345,
      has_aic_quantity: true,
      has_aic_gross_amount: true,
    })
  })

  it('detects native AI Credits reports when alias columns are absent', () => {
    const header = parseTokenUsageHeader(NATIVE_AI_CREDITS_HEADER_WITHOUT_ALIASES)
    const row = buildRow([
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
    ])
    const record = parseTokenUsageRecord(row, header)
    const adapter = selectUsageReportAdapter(header, record)

    expect(() => validateUsageReportHeader(header)).not.toThrow()
    expect(detectReportFormat(header, record)).toBe('native-ai-credits')
    expect(adapter.metadata.format).toBe('native-ai-credits')
    expect(() => validateUsageReportFirstRecord(header, record, { allowUnsupportedNativeAiCredits: true })).not.toThrow()
    expect(adapter.parseRecord(row, header)).toMatchObject({
      date: '2026-06-01',
      quantity: 42.726213,
      gross_amount: 0.4272621300000001,
      discount_amount: 0.4272621300000001,
      net_amount: 0,
      aic_quantity: 42.726213,
      aic_gross_amount: 0.4272621300000001,
      aic_net_amount: 0,
    })
  })

  it('normalizes native AI Credits dates through the unsupported adapter parser hook', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    const row = buildRow([
      '2026-06-01',
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
    ])
    const record = parseTokenUsageRecord(row, header)
    const adapter = selectUsageReportAdapter(header, record)

    expect(adapter.parseRecord(row.replace('2026-06-01', '6/1/26'), header)?.date).toBe('2026-06-01')
  })

  it('fails clearly for malformed billing headers before adapter selection', () => {
    const header = parseTokenUsageHeader('foo,bar,baz')

    expect(() => validateUsageReportHeader(header)).toThrow(InvalidReportError)
  })

  it('fails clearly for pre-AIC report headers before adapter selection', () => {
    const header = parseTokenUsageHeader([
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
    ].join(','))

    expect(() => validateUsageReportHeader(header)).toThrow(UnsupportedReportVersionError)
  })
})
