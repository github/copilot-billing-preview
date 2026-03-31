import { describe, expect, it } from 'vitest'
import {
  getUsageMetrics,
  parseCsvRow,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
} from './parser'

const FULL_HEADER = [
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

function buildRow(values: string[]): string {
  return values.join(',')
}

describe('parser and metric normalization', () => {
  it('parses headers with and without BOM', () => {
    const withBom = parseTokenUsageHeader(`\uFEFF${FULL_HEADER}`)
    const withoutBom = parseTokenUsageHeader(FULL_HEADER)

    expect(withBom.columns[0]).toBe('date')
    expect(withBom.index.date).toBe(0)
    expect(withoutBom.columns).toEqual(withBom.columns)
  })

  it('parses quoted CSV fields containing commas and escaped quotes', () => {
    expect(parseCsvRow('a,"b,c","d""e"')).toEqual(['a', 'b,c', 'd"e'])
  })

  it('parses known SKU values unchanged', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0.01',
        '0.07',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      header,
    )

    expect(record.sku).toBe('copilot_premium_request')
  })

  it('parses unknown SKU values unchanged rather than coercing or dropping them', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'custom_future_sku',
        'Claude Sonnet 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0.01',
        '0.07',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      header,
    )

    expect(record.sku).toBe('custom_future_sku')
  })

  it('parses total_monthly_quota as 0 when blank or invalid', () => {
    const fullHeader = parseTokenUsageHeader(FULL_HEADER)

    const blankQuota = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0.01',
        '0.07',
        'False',
        '',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      fullHeader,
    )

    const invalidQuota = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0.01',
        '0.07',
        'False',
        'not-a-number',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      fullHeader,
    )

    expect(blankQuota.total_monthly_quota).toBe(0)
    expect(invalidQuota.total_monthly_quota).toBe(0)
  })

  it('treats True, TRUE, and true as true for exceeds_quota', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)

    for (const boolValue of ['True', 'TRUE', 'true']) {
      const record = parseTokenUsageRecord(
        buildRow([
          '2026-03-01',
          'mona',
          'copilot',
          'copilot_premium_request',
          'Claude Sonnet 4.5',
          '2',
          'requests',
          '0.04',
          '0.08',
          '0.01',
          '0.07',
          boolValue,
          '300',
          'octodemo',
          'Octocats',
          '1.5',
          '0.015',
        ]),
        header,
      )

      expect(record.exceeds_quota).toBe(true)
    }
  })

  it('keeps PRU metrics for requests rows', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '2.5',
        'requests',
        '0.04',
        '0.10',
        '0.03',
        '0.07',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      header,
    )

    expect(getUsageMetrics(record)).toMatchObject({
      requests: 2.5,
      grossAmount: 0.1,
      discountAmount: 0.03,
      netAmount: 0.07,
    })
  })

  it('prefers explicit aic values for ai-units rows', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_unit',
        'Claude Sonnet 4.5',
        '50',
        'ai-units',
        '0.01',
        '0.50',
        '0',
        '0.50',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '75',
        '0.75',
      ]),
      header,
    )

    expect(getUsageMetrics(record)).toMatchObject({
      aicQuantity: 75,
      aicGrossAmount: 0.75,
      aicNetAmount: 0.75,
    })
  })

  it('falls back to quantity and gross_amount for ai-units rows when explicit aic values are blank', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_unit',
        'Claude Sonnet 4.5',
        '50',
        'ai-units',
        '0.01',
        '0.50',
        '0',
        '0.50',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '',
        '',
      ]),
      header,
    )

    expect(getUsageMetrics(record)).toMatchObject({
      aicQuantity: 50,
      aicGrossAmount: 0.5,
      aicNetAmount: 0.5,
    })
  })

  it('zeros PRU metrics for ai-units rows in getUsageMetrics', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_unit',
        'Claude Sonnet 4.5',
        '50',
        'ai-units',
        '0.01',
        '0.50',
        '0.10',
        '0.40',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '75',
        '0.75',
      ]),
      header,
    )

    expect(getUsageMetrics(record)).toMatchObject({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
    })
  })

  it('initializes aic_net_amount to AIC gross before pooled allocation', () => {
    const withExplicitAicHeader = parseTokenUsageHeader(FULL_HEADER)
    const explicitAicRecord = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_unit',
        'Claude Sonnet 4.5',
        '50',
        'ai-units',
        '0.01',
        '0.50',
        '0',
        '0.50',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '75',
        '0.75',
      ]),
      withExplicitAicHeader,
    )

    const fallbackAicRecord = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_unit',
        'Claude Sonnet 4.5',
        '50',
        'ai-units',
        '0.01',
        '0.50',
        '0',
        '0.50',
        'False',
        '300',
        'octodemo',
        'Octocats',
        '',
        '',
      ]),
      withExplicitAicHeader,
    )

    expect(explicitAicRecord.aic_net_amount).toBe(0.75)
    expect(fallbackAicRecord.aic_net_amount).toBe(0.5)
  })
})
