import { describe, expect, it } from 'vitest'
import {
  getUsageMetrics,
  InvalidReportError,
  normalizeTokenUsageRecord,
  parseCsvRow,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
  UnsupportedReportVersionError,
  validateHeader,
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

  it('parses known SKU values unchanged, including Spark SKUs', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const copilotRecord = parseTokenUsageRecord(
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
    const sparkRecord = parseTokenUsageRecord(
      buildRow([
        '2026-03-31',
        'test-user-spark',
        'spark',
        'spark_premium_request',
        'Claude Sonnet 4.5',
        '16',
        'requests',
        '0.04',
        '0.64',
        '0.64',
        '0',
        'FALSE',
        '1000',
        'example-org',
        'Cost Center A',
        '222.17411999999996',
        '2.2217412',
      ]),
      header,
    )

    expect(copilotRecord.sku).toBe('copilot_premium_request')
    expect(sparkRecord.product).toBe('spark')
    expect(sparkRecord.sku).toBe('spark_premium_request')
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

  it('defaults exceeds_quota to false when the column is absent', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
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
        '300',
        'octodemo',
        'Octocats',
        '1.5',
        '0.015',
      ]),
      header,
    )

    expect(record.exceeds_quota).toBe(false)
  })

  it('maps ai credits columns by name when their order is reversed', () => {
    const reversedAicHeader = [
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
      'aic_gross_amount',
      'aic_quantity',
    ].join(',')
    const header = parseTokenUsageHeader(reversedAicHeader)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '50',
        'ai-credits',
        '0.01',
        '0.50',
        '0',
        '0.50',
        '300',
        'octodemo',
        'Octocats',
        '0.75',
        '75',
      ]),
      header,
    )

    expect(record.aic_quantity).toBe(75)
    expect(record.aic_gross_amount).toBe(0.75)
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

  it('prefers explicit aic values for ai-credits rows', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '50',
        'ai-credits',
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

  it('falls back to quantity and gross_amount for ai-credits rows when explicit aic values are blank', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '50',
        'ai-credits',
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

  it('treats non-request unit types as AIC rows in getUsageMetrics', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-03-01',
        'mona',
        'copilot',
        'future_ai_credit_sku',
        'Claude Sonnet 4.5',
        '50',
        'future-ai-credit-unit',
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
      aicQuantity: 75,
      grossAmount: 0,
      aicGrossAmount: 0.75,
      aicNetAmount: 0.75,
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
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '50',
        'ai-credits',
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
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '50',
        'ai-credits',
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

  // normalize known export window
  it('drops invalid rows in the known normalization window', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-04-24',
        'mona',
        'copilot',
        'copilot_premium_request',
        'GPT-5.3',
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
        '3.5',
        '0.035',
      ]),
      header,
    )

    expect(normalizeTokenUsageRecord(record)).toBeNull()
  })

  it('halves AIC values and clears quantity in the known normalization window', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-04-30',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '12',
        'requests',
        '0.04',
        '0.48',
        '0',
        '0.48',
        'False',
        '0',
        '',
        '',
        '120',
        '1.20',
      ]),
      header,
    )

    expect(normalizeTokenUsageRecord(record)).toMatchObject({
      quantity: 0,
      gross_amount: 0,
      discount_amount: 0,
      net_amount: 0,
      aic_quantity: 60,
      aic_gross_amount: 0.6,
      aic_net_amount: 0.6,
      has_aic_quantity: true,
      has_aic_gross_amount: true,
    })
  })

  it('leaves records outside the known normalization window unchanged', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-01',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '12',
        'requests',
        '0.04',
        '0.48',
        '0',
        '0.48',
        'False',
        '0',
        '',
        '',
        '120',
        '1.20',
      ]),
      header,
    )

    expect(normalizeTokenUsageRecord(record)).toBe(record)
  })

  it('leaves non-impacted records in the known normalization window unchanged', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-04-30',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Claude Sonnet 4.5',
        '12',
        'requests',
        '0.04',
        '0.48',
        '0',
        '0.48',
        'False',
        '300',
        '',
        '',
        '120',
        '1.20',
      ]),
      header,
    )

    expect(normalizeTokenUsageRecord(record)).toBe(record)
  })

  it('leaves AI-credit records in the known normalization window unchanged', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-04-30',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Claude Sonnet 4.5',
        '120',
        'ai-credits',
        '0.01',
        '1.20',
        '0',
        '1.20',
        'False',
        '0',
        '',
        '',
        '120',
        '1.20',
      ]),
      header,
    )

    expect(normalizeTokenUsageRecord(record)).toBe(record)
  })
})

describe('validateHeader', () => {
  it('accepts a header that contains all required columns', () => {
    const header = parseTokenUsageHeader(FULL_HEADER)
    expect(() => validateHeader(header)).not.toThrow()
  })

  it('accepts a header when exceeds_quota is absent', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    expect(() => validateHeader(header)).not.toThrow()
  })

  it('throws InvalidReportError when core billing columns are missing', () => {
    const header = parseTokenUsageHeader('foo,bar,baz')
    expect(() => validateHeader(header)).toThrow(InvalidReportError)
  })

  it('throws UnsupportedReportVersionError when only aic columns are missing', () => {
    const legacyHeader = [
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
    const header = parseTokenUsageHeader(legacyHeader)
    expect(() => validateHeader(header)).toThrow(UnsupportedReportVersionError)
  })

  it('throws UnsupportedReportVersionError when only one aic column is missing', () => {
    const legacyHeader = [
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
    ].join(',')
    const header = parseTokenUsageHeader(legacyHeader)
    expect(() => validateHeader(header)).toThrow(UnsupportedReportVersionError)
  })

  it('throws InvalidReportError when a billing header omits a required non-aic billing column', () => {
    const incompleteBillingHeader = [
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
      // net_amount intentionally omitted
      'exceeds_quota',
      'total_monthly_quota',
      'organization',
      'cost_center_name',
      'aic_quantity',
      'aic_gross_amount',
    ].join(',')
    const header = parseTokenUsageHeader(incompleteBillingHeader)
    expect(() => validateHeader(header)).toThrow(InvalidReportError)
  })
})
