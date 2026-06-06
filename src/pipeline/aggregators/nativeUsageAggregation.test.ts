import { describe, expect, it } from 'vitest'

import { parseNativeAiCreditsUsageRecord, parseTokenUsageHeader, type TokenUsageRecord } from '../parser'
import { CostCenterAggregator } from './costCenterAggregator'
import { DailyUsageAggregator } from './dailyUsageAggregator'
import { ModelUsageAggregator } from './modelUsageAggregator'
import { OrganizationAggregator } from './organizationAggregator'
import { ProductUsageAggregator } from './productUsageAggregator'
import { UserUsageAggregator } from './userUsageAggregator'

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

function nativeRecord(values: string[]): TokenUsageRecord {
  return parseNativeAiCreditsUsageRecord(values.join(','), NATIVE_AI_CREDITS_PARSED_HEADER)
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
      'GPT-5.2',
      '25',
      'ai-credits',
      '0.01',
      '250',
      '50',
      '200',
      '3900',
      'octodemo',
      'Cost Center B',
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
      '3900',
      'example-org',
      'Cost Center A',
      '4000',
      '4000',
    ]),
  ]
}

function aggregate(records: TokenUsageRecord[]) {
  const daily = new DailyUsageAggregator('native-ai-credits')
  const users = new UserUsageAggregator('native-ai-credits')
  const organizations = new OrganizationAggregator('native-ai-credits')
  const costCenters = new CostCenterAggregator('native-ai-credits')
  const models = new ModelUsageAggregator('native-ai-credits')
  const products = new ProductUsageAggregator('native-ai-credits')
  const aggregators = [daily, users, organizations, costCenters, models, products]

  records.forEach((record) => {
    aggregators.forEach((aggregator) => aggregator.accumulate(record))
  })

  return {
    daily: daily.result(),
    users: users.result(),
    organizations: organizations.result(),
    costCenters: costCenters.result(),
    models: models.result(),
    products: products.result(),
  }
}

describe('native AI Credits direct aggregator usage', () => {
  it('keeps native usage test-only while mapping canonical AIC metrics into existing daily and model fields', () => {
    const result = aggregate(nativeRecords())

    expect(result.daily.dailyData).toEqual([
      expect.objectContaining({
        date: '2026-05-29',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 35,
        aicGrossAmount: 350,
        aicNetAmount: 280,
      }),
      expect.objectContaining({
        date: '2026-05-30',
        requests: 0,
        grossAmount: 0,
        discountAmount: 0,
        netAmount: 0,
        aicQuantity: 40,
        aicGrossAmount: 400,
        aicNetAmount: 325,
      }),
    ])

    expect(result.models.totalsByModel['GPT-5.2']).toEqual({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 35,
      aicGrossAmount: 350,
      aicNetAmount: 280,
    })
    expect(result.models.totalsByModel['Copilot Coding Agent: Claude Sonnet 4.6']).toEqual({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 40,
      aicGrossAmount: 400,
      aicNetAmount: 325,
    })
  })

  it('maps native actual costs into product, user, organization, and cost-center aic fields', () => {
    const result = aggregate(nativeRecords())

    const copilot = result.products.products.find((product) => product.product === 'Copilot')
    expect(copilot?.totals).toEqual({
      requests: 0,
      grossAmount: 0,
      netAmount: 0,
      aicQuantity: 10,
      aicGrossAmount: 100,
      aicNetAmount: 80,
    })
    expect(copilot?.models['GPT-5.2']).toEqual({
      requests: 0,
      grossAmount: 0,
      netAmount: 0,
      aicQuantity: 10,
      aicGrossAmount: 100,
      aicNetAmount: 80,
    })

    const mona = result.users.users.find((user) => user.username === 'mona')
    expect(mona?.totals).toEqual(expect.objectContaining({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 10,
      aicGrossAmount: 100,
      aicNetAmount: 80,
    }))
    expect(mona?.daily['2026-05-29']).toEqual(expect.objectContaining({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 10,
      aicGrossAmount: 100,
      aicNetAmount: 80,
    }))

    const exampleOrg = result.organizations.organizations.find((organization) => organization.organization === 'example-org')
    expect(exampleOrg?.totals).toEqual({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 50,
      aicGrossAmount: 500,
      aicNetAmount: 405,
    })
    expect(exampleOrg?.totalsByUser.mona).toEqual({
      requests: 0,
      grossAmount: 0,
      netAmount: 0,
      aicQuantity: 10,
      aicGrossAmount: 100,
      aicNetAmount: 80,
    })

    const costCenter = result.costCenters.costCenters.find((entry) => entry.costCenterName === 'Cost Center A')
    expect(costCenter?.totals).toEqual({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 50,
      aicGrossAmount: 500,
      aicNetAmount: 405,
    })
    expect(costCenter?.totalsByUser.octocat).toEqual({
      requests: 0,
      grossAmount: 0,
      netAmount: 0,
      aicQuantity: 40,
      aicGrossAmount: 400,
      aicNetAmount: 325,
    })
  })

  it('preserves native Business and Enterprise quota identities for license classification', () => {
    const result = aggregate([
      nativeRecord([
        '2026-06-01',
        'test-business-user',
        'copilot',
        'copilot_ai_credit',
        'Auto: GPT-5.3-Codex',
        '5.447169000000001',
        'ai-credits',
        '0.01',
        '0.054471689999999996',
        '0.054471689999999996',
        '0',
        '1900',
        'example-org',
        '',
        '5.447169000000001',
        '0.05447169',
      ]),
      nativeRecord([
        '2026-06-01',
        'test-enterprise-user',
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
        '42.726213',
        '0.4272621300000002',
      ]),
    ])

    expect(result.users.users).toEqual([
      expect.objectContaining({
        username: 'test-business-user',
        totalMonthlyQuota: 1900,
      }),
      expect.objectContaining({
        username: 'test-enterprise-user',
        totalMonthlyQuota: 3900,
      }),
    ])
  })
})
