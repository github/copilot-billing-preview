import { describe, expect, it } from 'vitest'

import { getDisplayModelName } from './modelLabels'
import { parseNativeAiCreditsUsageRecord, parseTokenUsageHeader, type TokenUsageRecord } from './parser'
import { getFriendlyProductName } from './productClassification'
import { getReportUsageMetrics, type CanonicalAiCreditsMetrics } from './reportUsageMetrics'

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
const NATIVE_AI_CREDITS_PARSED_HEADER = parseTokenUsageHeader(NATIVE_AI_CREDITS_HEADER)

type ProductRollup = {
  totals: CanonicalAiCreditsMetrics
  models: Record<string, CanonicalAiCreditsMetrics>
}

type NativeUsageRollups = {
  byDate: Record<string, CanonicalAiCreditsMetrics>
  byUser: Record<string, CanonicalAiCreditsMetrics>
  byModel: Record<string, CanonicalAiCreditsMetrics>
  byProduct: Record<string, ProductRollup>
}

function createMetrics(): CanonicalAiCreditsMetrics {
  return {
    quantity: 0,
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  }
}

function ensureMetrics(
  rollup: Record<string, CanonicalAiCreditsMetrics>,
  key: string,
): CanonicalAiCreditsMetrics {
  rollup[key] ??= createMetrics()
  return rollup[key]
}

function ensureProduct(rollup: Record<string, ProductRollup>, product: string): ProductRollup {
  rollup[product] ??= {
    totals: createMetrics(),
    models: {},
  }
  return rollup[product]
}

function addMetrics(total: CanonicalAiCreditsMetrics, metric: CanonicalAiCreditsMetrics): void {
  total.quantity += metric.quantity
  total.grossAmount += metric.grossAmount
  total.discountAmount += metric.discountAmount
  total.netAmount += metric.netAmount
}

function aggregateNativeReportUsageMetrics(records: TokenUsageRecord[]): NativeUsageRollups {
  const rollups: NativeUsageRollups = {
    byDate: {},
    byUser: {},
    byModel: {},
    byProduct: {},
  }

  for (const record of records) {
    const usage = getReportUsageMetrics(record, 'native-ai-credits')
    const model = getDisplayModelName(record.model)
    const product = getFriendlyProductName(record)

    addMetrics(ensureMetrics(rollups.byDate, record.date), usage.aiCredits)
    addMetrics(ensureMetrics(rollups.byUser, record.username), usage.aiCredits)
    addMetrics(ensureMetrics(rollups.byModel, model), usage.aiCredits)

    const productRollup = ensureProduct(rollups.byProduct, product)
    addMetrics(productRollup.totals, usage.aiCredits)
    addMetrics(ensureMetrics(productRollup.models, model), usage.aiCredits)
  }

  return rollups
}

function buildRow(values: string[]): string {
  return values.join(',')
}

function nativeRecord(values: string[]): TokenUsageRecord {
  return parseNativeAiCreditsUsageRecord(buildRow(values), NATIVE_AI_CREDITS_PARSED_HEADER)
}

function nativeRecords(): TokenUsageRecord[] {
  return [
    nativeRecord([
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
    ]),
    nativeRecord([
      '05/29/2026',
      'hubot',
      'spark',
      'spark_ai_credit',
      ' GPT-5.2 ',
      '25',
      'ai-credits',
      '0.01',
      '250',
      '50',
      '200',
      '7000',
      'octodemo',
      '',
      '',
      '',
    ]),
    nativeRecord([
      '2026-05-30',
      'octocat',
      'copilot',
      'coding_agent_ai_credit',
      'Copilot Coding Agent: Claude Sonnet 4.6',
      '40',
      'ai-credits',
      '0.01',
      '400',
      '75',
      '325',
      '7000',
      'example-org',
      'Cost Center A',
      '4000',
      '4000',
    ]),
    nativeRecord([
      '6/1/26',
      'mona',
      'copilot',
      'copilot_ai_credit',
      ' ',
      '5',
      'ai-credits',
      '0.01',
      '50',
      '10',
      '40',
      '3900',
      'example-org',
      '',
      '5000',
      '5000',
    ]),
  ]
}

describe('native AI Credits report usage aggregation harness', () => {
  it('rolls up parsed native rows by normalized ISO date', () => {
    const rollups = aggregateNativeReportUsageMetrics(nativeRecords())

    expect(rollups.byDate).toEqual({
      '2026-05-29': {
        quantity: 35,
        grossAmount: 350,
        discountAmount: 70,
        netAmount: 280,
      },
      '2026-05-30': {
        quantity: 40,
        grossAmount: 400,
        discountAmount: 75,
        netAmount: 325,
      },
      '2026-06-01': {
        quantity: 5,
        grossAmount: 50,
        discountAmount: 10,
        netAmount: 40,
      },
    })
    expect(rollups.byDate).not.toHaveProperty('5/29/26')
    expect(rollups.byDate).not.toHaveProperty('05/29/2026')
  })

  it('rolls up native AI Credits by user using native actual cost fields', () => {
    const rollups = aggregateNativeReportUsageMetrics(nativeRecords())

    expect(rollups.byUser).toEqual({
      hubot: {
        quantity: 25,
        grossAmount: 250,
        discountAmount: 50,
        netAmount: 200,
      },
      mona: {
        quantity: 15,
        grossAmount: 150,
        discountAmount: 30,
        netAmount: 120,
      },
      octocat: {
        quantity: 40,
        grossAmount: 400,
        discountAmount: 75,
        netAmount: 325,
      },
    })
  })

  it('rolls up native AI Credits by display model label', () => {
    const rollups = aggregateNativeReportUsageMetrics(nativeRecords())

    expect(rollups.byModel).toEqual({
      'Copilot Coding Agent: Claude Sonnet 4.6': {
        quantity: 40,
        grossAmount: 400,
        discountAmount: 75,
        netAmount: 325,
      },
      'GPT-5.2': {
        quantity: 35,
        grossAmount: 350,
        discountAmount: 70,
        netAmount: 280,
      },
      Unlabeled: {
        quantity: 5,
        grossAmount: 50,
        discountAmount: 10,
        netAmount: 40,
      },
    })
  })

  it('rolls up native AI Credits by friendly product and nested model labels', () => {
    const rollups = aggregateNativeReportUsageMetrics(nativeRecords())

    expect(rollups.byProduct).toEqual({
      Copilot: {
        totals: {
          quantity: 15,
          grossAmount: 150,
          discountAmount: 30,
          netAmount: 120,
        },
        models: {
          'GPT-5.2': {
            quantity: 10,
            grossAmount: 100,
            discountAmount: 20,
            netAmount: 80,
          },
          Unlabeled: {
            quantity: 5,
            grossAmount: 50,
            discountAmount: 10,
            netAmount: 40,
          },
        },
      },
      'Copilot Cloud Agent': {
        totals: {
          quantity: 40,
          grossAmount: 400,
          discountAmount: 75,
          netAmount: 325,
        },
        models: {
          'Copilot Coding Agent: Claude Sonnet 4.6': {
            quantity: 40,
            grossAmount: 400,
            discountAmount: 75,
            netAmount: 325,
          },
        },
      },
      Spark: {
        totals: {
          quantity: 25,
          grossAmount: 250,
          discountAmount: 50,
          netAmount: 200,
        },
        models: {
          'GPT-5.2': {
            quantity: 25,
            grossAmount: 250,
            discountAmount: 50,
            netAmount: 200,
          },
        },
      },
    })
  })
})
