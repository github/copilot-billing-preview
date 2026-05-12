import { describe, expect, it } from 'vitest'
import { CostCenterAggregator } from './costCenterAggregator'
import { DailyUsageAggregator } from './dailyUsageAggregator'
import { ModelUsageAggregator } from './modelUsageAggregator'
import { OrganizationAggregator } from './organizationAggregator'
import { ProductUsageAggregator } from './productUsageAggregator'
import { UserUsageAggregator } from './userUsageAggregator'
import { UNLABELED_MODEL_NAME } from '../modelLabels'
import type { TokenUsageRecord } from '../parser'
import {
  NON_COPILOT_CODE_REVIEW_USER_LABEL,
} from '../productClassification'

function createRecord(overrides: Partial<TokenUsageRecord> = {}): TokenUsageRecord {
  return {
    date: '2026-03-01',
    username: 'mona',
    product: 'copilot',
    sku: 'copilot_premium_request',
    model: 'GPT-5',
    quantity: 10,
    unit_type: 'requests',
    applied_cost_per_quantity: 0.1,
    gross_amount: 1,
    discount_amount: 0.2,
    net_amount: 0.8,
    exceeds_quota: false,
    total_monthly_quota: 300,
    organization: 'octo',
    cost_center_name: 'Cats',
    aic_quantity: 0,
    aic_gross_amount: 0,
    aic_net_amount: 0,
    has_aic_quantity: true,
    has_aic_gross_amount: true,
    ...overrides,
  }
}

function createFixture(): TokenUsageRecord[] {
  return [
    createRecord(),
    createRecord({
      model: 'Code Review model',
      quantity: 5,
      gross_amount: 2,
      discount_amount: 0.5,
      net_amount: 1.5,
    }),
    createRecord({
      username: 'hubot',
      model: 'Coding Agent model',
      quantity: 8,
      gross_amount: 4,
      discount_amount: 1,
      net_amount: 3,
      total_monthly_quota: 1000,
      cost_center_name: 'Dogs',
    }),
    createRecord({
      date: '2026-03-02',
      username: 'hubot',
      model: 'GPT-4.1',
      quantity: 2,
      gross_amount: 1,
      discount_amount: 0.25,
      net_amount: 0.75,
      total_monthly_quota: 1000,
      organization: '',
      cost_center_name: null,
    }),
    createRecord({
      date: '2026-03-02',
      unit_type: 'ai-credits',
      sku: 'copilot_ai_credit',
      quantity: 100,
      applied_cost_per_quantity: 0.01,
      gross_amount: 1,
      discount_amount: 0,
      net_amount: 1,
      aic_quantity: 100,
      aic_gross_amount: 1,
      aic_net_amount: 0.6,
    }),
    createRecord({
      date: '2026-03-31',
      username: 'test-user-spark',
      product: 'spark',
      sku: 'spark_premium_request',
      model: 'Claude Sonnet 4.5',
      quantity: 16,
      unit_type: 'requests',
      applied_cost_per_quantity: 0.04,
      gross_amount: 0.64,
      discount_amount: 0.64,
      net_amount: 0,
      total_monthly_quota: 1000,
      organization: 'example-org',
      cost_center_name: 'Cost Center A',
      aic_quantity: 222.17411999999996,
      aic_gross_amount: 2.2217412,
      aic_net_amount: 2.2217412,
    }),
  ]
}

function createAiOnlyFixture(): TokenUsageRecord[] {
  return [
    createRecord({
      date: '2026-03-03',
      unit_type: 'ai-credits',
      sku: 'copilot_ai_credit',
      quantity: 50,
      applied_cost_per_quantity: 0.01,
      gross_amount: 0.5,
      discount_amount: 0,
      net_amount: 0.5,
      aic_quantity: 50,
      aic_gross_amount: 0.5,
      aic_net_amount: 0.2,
    }),
  ]
}

function sumNumbers(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function expectCloseMoney(actual: number, expected: number): void {
  expect(actual).toBeCloseTo(expected)
}

function expectNetEquation(totals: { grossAmount: number; discountAmount: number; netAmount: number }): void {
  expect(totals.grossAmount - totals.discountAmount).toBeCloseTo(totals.netAmount)
}

const userProductMetricKeys = [
  'requests',
  'grossAmount',
  'discountAmount',
  'netAmount',
  'aicQuantity',
  'aicGrossAmount',
  'aicNetAmount',
] as const

function aggregate(records: TokenUsageRecord[]) {
  const daily = new DailyUsageAggregator()
  const users = new UserUsageAggregator()
  const organizations = new OrganizationAggregator()
  const costCenters = new CostCenterAggregator()
  const models = new ModelUsageAggregator()
  const products = new ProductUsageAggregator()
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

describe('PRU gross/net/discount aggregation', () => {
  it('labels empty model values as unlabeled across model breakdowns', () => {
    const result = aggregate([
      createRecord({ model: '', quantity: 3, gross_amount: 1.5, discount_amount: 0.5, net_amount: 1 }),
    ])

    expect(result.models.models).toEqual([UNLABELED_MODEL_NAME])
    expect(result.models.totalsByModel[UNLABELED_MODEL_NAME]).toEqual(expect.objectContaining({ requests: 3, grossAmount: 1.5, netAmount: 1 }))

    const user = result.users.users[0]
    expect(Object.keys(user.daily['2026-03-01'].models)).toEqual([UNLABELED_MODEL_NAME])
    expect(Object.keys(user.products.Copilot.models)).toEqual([UNLABELED_MODEL_NAME])

    const organization = result.organizations.organizations[0]
    expect(Object.keys(organization.totalsByModel)).toEqual([UNLABELED_MODEL_NAME])

    const costCenter = result.costCenters.costCenters[0]
    expect(Object.keys(costCenter.totalsByModel)).toEqual([UNLABELED_MODEL_NAME])

    const product = result.products.products[0]
    expect(Object.keys(product.models)).toEqual([UNLABELED_MODEL_NAME])
  })

  it('keeps aggregated request gross minus discount equal to net across PRU aggregators', () => {
    const result = aggregate(createFixture())

    result.daily.dailyData.forEach(expectNetEquation)
    result.users.users.forEach((user) => {
      expectNetEquation(user.totals)
      Object.values(user.daily).forEach((day) => {
        expectNetEquation(day)
        Object.values(day.models).forEach(expectNetEquation)
      })
    })
    result.organizations.organizations.forEach((organization) => {
      expectNetEquation(organization.totals)
    })
    result.costCenters.costCenters.forEach((costCenter) => {
      expectNetEquation(costCenter.totals)
      Object.values(costCenter.totalsByModel).forEach(expectNetEquation)
    })
    Object.values(result.models.totalsByModel).forEach(expectNetEquation)
    Object.values(result.models.byModel).flat().forEach(expectNetEquation)
  })

  it('keeps PRU totals at zero for AI-credit rows in every aggregator', () => {
    const result = aggregate(createAiOnlyFixture())

    expect(result.daily.dailyData).toEqual([
      expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }),
    ])
    expect(result.users.users[0].totals).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
    expect(result.organizations.organizations[0].totals).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
    expect(result.costCenters.costCenters[0].totals).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
    expect(result.models.totalsByModel['GPT-5']).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
    expect(result.products.products[0].totals).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, netAmount: 0 }))
  })

  it('keeps daily, user, and organization request totals aligned for the same fixture', () => {
    const result = aggregate(createFixture())

    const dailyGross = sumNumbers(result.daily.dailyData.map((day) => day.grossAmount))
    const dailyNet = sumNumbers(result.daily.dailyData.map((day) => day.netAmount))
    const dailyDiscount = sumNumbers(result.daily.dailyData.map((day) => day.discountAmount))
    const userGross = sumNumbers(result.users.users.map((user) => user.totals.grossAmount))
    const userNet = sumNumbers(result.users.users.map((user) => user.totals.netAmount))
    const userDiscount = sumNumbers(result.users.users.map((user) => user.totals.discountAmount))

    expect({ dailyGross, dailyNet, dailyDiscount }).toEqual({
      dailyGross: userGross,
      dailyNet: userNet,
      dailyDiscount: userDiscount,
    })

    const organization = result.organizations.organizations.find((entry) => entry.organization === 'octo')
    expect(organization).toBeDefined()
    expect(organization!.organization).toBe('octo')
    expect(organization!.totals.requests).toBe(23)
    expectCloseMoney(organization!.totals.grossAmount, 7)
    expectCloseMoney(organization!.totals.discountAmount, 1.7)
    expectCloseMoney(organization!.totals.netAmount, 5.3)
  })

  it('keeps cost-center totals aligned with per-model and per-user rollups', () => {
    const result = aggregate(createFixture())
    const cats = result.costCenters.costCenters.find((costCenter) => costCenter.costCenterName === 'Cats')

    expect(cats).toBeDefined()
    expect(cats?.totals.requests).toBe(15)
    expectCloseMoney(cats!.totals.grossAmount, 3)
    expectCloseMoney(cats!.totals.discountAmount, 0.7)
    expectCloseMoney(cats!.totals.netAmount, 2.3)
    expect(sumNumbers(Object.values(cats?.totalsByModel ?? {}).map((totals) => totals.grossAmount))).toBeCloseTo(cats!.totals.grossAmount)
    expect(sumNumbers(Object.values(cats?.totalsByModel ?? {}).map((totals) => totals.netAmount))).toBeCloseTo(cats!.totals.netAmount)
    expect(sumNumbers(Object.values(cats?.totalsByUser ?? {}).map((totals) => totals.grossAmount))).toBeCloseTo(cats!.totals.grossAmount)
    expect(sumNumbers(Object.values(cats?.totalsByUser ?? {}).map((totals) => totals.netAmount))).toBeCloseTo(cats!.totals.netAmount)
  })

  it('keeps user totals aligned with daily totals and model totals aligned with per-day values', () => {
    const result = aggregate(createFixture())
    const mona = result.users.users.find((user) => user.username === 'mona')

    expect(mona).toBeDefined()
    expect(sumNumbers(Object.values(mona?.daily ?? {}).map((day) => day.grossAmount))).toBeCloseTo(mona!.totals.grossAmount)
    expect(sumNumbers(Object.values(mona?.daily ?? {}).map((day) => day.netAmount))).toBeCloseTo(mona!.totals.netAmount)
    userProductMetricKeys.forEach((key) => {
      expect(sumNumbers(Object.values(mona?.products ?? {}).map((product) => product.totals[key]))).toBeCloseTo(mona!.totals[key])
    })
    Object.values(mona?.products ?? {}).forEach((product) => {
      userProductMetricKeys.forEach((key) => {
        expect(sumNumbers(Object.values(product.models).map((model) => model[key]))).toBeCloseTo(product.totals[key])
      })
    })
    expect(sumNumbers(result.models.byModel['GPT-5'].map((day) => day.grossAmount))).toBeCloseTo(result.models.totalsByModel['GPT-5'].grossAmount)
    expect(sumNumbers(result.models.byModel['GPT-5'].map((day) => day.netAmount))).toBeCloseTo(result.models.totalsByModel['GPT-5'].netAmount)
  })

  it('keeps product totals aligned with per-model breakdowns and uses friendly labels, including Spark', () => {
    const result = aggregate(createFixture())

    expect(result.products.products.map((product) => product.product)).toEqual([
      'Copilot',
      'Copilot Cloud Agent',
      'Spark',
    ])

    result.products.products.forEach((product) => {
      expect(sumNumbers(Object.values(product.models).map((model) => model.grossAmount))).toBeCloseTo(product.totals.grossAmount)
      expect(sumNumbers(Object.values(product.models).map((model) => model.netAmount))).toBeCloseTo(product.totals.netAmount)
    })

    const copilot = result.products.products.find((product) => product.product === 'Copilot')
    expect(Object.keys(copilot?.models ?? {}).sort()).toEqual(['Code Review model', 'GPT-4.1', 'GPT-5'])

    const spark = result.products.products.find((product) => product.product === 'Spark')
    expect(spark).toEqual(expect.objectContaining({
      totals: expect.objectContaining({
        requests: 16,
        netAmount: 0,
        aicQuantity: 222.17411999999996,
        aicNetAmount: 2.2217412,
      }),
    }))
    expect(Object.keys(spark?.models ?? {})).toEqual(['Claude Sonnet 4.5'])
  })

  it('treats blank-username code review rows as an organization-billed product bucket', () => {
    const result = aggregate([
      createRecord({
        username: '',
        model: 'Code Review model',
        quantity: 12,
        gross_amount: 4.8,
        discount_amount: 0.8,
        net_amount: 4,
        organization: 'octo',
        cost_center_name: 'Cats',
      }),
    ])

    expect(result.users.users).toEqual([])

    expect(result.products.products).toEqual([
      expect.objectContaining({
        product: 'Copilot',
        totals: expect.objectContaining({
          requests: 12,
          grossAmount: 4.8,
          netAmount: 4,
        }),
        models: {
          'Code Review model': expect.objectContaining({
            requests: 12,
            grossAmount: 4.8,
            netAmount: 4,
          }),
        },
      }),
    ])

    expect(result.organizations.organizations).toEqual([
      expect.objectContaining({
        organization: 'octo',
        userCount: 0,
        totalsByUser: {
          [NON_COPILOT_CODE_REVIEW_USER_LABEL]: expect.objectContaining({
            requests: 12,
            grossAmount: 4.8,
            netAmount: 4,
          }),
        },
      }),
    ])

    expect(result.costCenters.costCenters).toEqual([
      expect.objectContaining({
        costCenterName: 'Cats',
        userCount: 0,
        totalsByUser: {
          [NON_COPILOT_CODE_REVIEW_USER_LABEL]: expect.objectContaining({
            requests: 12,
            grossAmount: 4.8,
            netAmount: 4,
          }),
        },
      }),
    ])
  })

  it('sorts results by current implementation rules and only skips blank organization or cost center where required', () => {
    const result = aggregate(createFixture())

    expect(result.daily.dailyData.map((day) => day.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-31'])
    expect(result.users.users.map((user) => user.username)).toEqual(['hubot', 'mona', 'test-user-spark'])
    expect(result.organizations.organizations.map((organization) => organization.organization)).toEqual(['example-org', 'octo'])
    expect(result.costCenters.costCenters.map((costCenter) => costCenter.costCenterName)).toEqual(['Cats', 'Cost Center A', 'Dogs'])
    expect(result.models.models).toEqual(['Claude Sonnet 4.5', 'Code Review model', 'Coding Agent model', 'GPT-4.1', 'GPT-5'])

    const hubot = result.users.users.find((user) => user.username === 'hubot')
    expect(hubot?.totals).toEqual(expect.objectContaining({ requests: 10, grossAmount: 5, discountAmount: 1.25, netAmount: 3.75 }))
    expect(hubot?.organizations).toEqual(['octo'])
    expect(hubot?.costCenters).toEqual(['Dogs'])
  })

  it('keeps only the top 20 model and user breakdowns per cost center ranked by AIC quantity', () => {
    const aggregator = new CostCenterAggregator()

    for (let i = 0; i < 25; i += 1) {
      aggregator.accumulate(createRecord({
        username: `user-${i.toString().padStart(2, '0')}`,
        model: `Model ${i.toString().padStart(2, '0')}`,
        cost_center_name: 'Cats',
        quantity: 0,
        gross_amount: 0,
        discount_amount: 0,
        net_amount: 0,
        unit_type: 'ai-credits',
        sku: 'copilot_ai_credit',
        aic_quantity: i + 1,
        aic_gross_amount: i + 1,
        aic_net_amount: i + 1,
      }))
    }

    const cats = aggregator.result().costCenters.find((costCenter) => costCenter.costCenterName === 'Cats')

    expect(cats).toBeDefined()
    expect(Object.keys(cats!.totalsByModel)).toHaveLength(20)
    expect(Object.keys(cats!.totalsByUser)).toHaveLength(20)
    expect(Object.keys(cats!.totalsByModel)).toEqual([
      'Model 24',
      'Model 23',
      'Model 22',
      'Model 21',
      'Model 20',
      'Model 19',
      'Model 18',
      'Model 17',
      'Model 16',
      'Model 15',
      'Model 14',
      'Model 13',
      'Model 12',
      'Model 11',
      'Model 10',
      'Model 09',
      'Model 08',
      'Model 07',
      'Model 06',
      'Model 05',
    ])
    expect(Object.keys(cats!.totalsByUser)).toEqual([
      'user-24',
      'user-23',
      'user-22',
      'user-21',
      'user-20',
      'user-19',
      'user-18',
      'user-17',
      'user-16',
      'user-15',
      'user-14',
      'user-13',
      'user-12',
      'user-11',
      'user-10',
      'user-09',
      'user-08',
      'user-07',
      'user-06',
      'user-05',
    ])
    expect(cats!.totalsByModel['Model 04']).toBeUndefined()
    expect(cats!.totalsByUser['user-04']).toBeUndefined()
    expect(cats!.totals.aicQuantity).toBe(325)
  })

  it('keeps only the top 20 model and user breakdowns per organization ranked by AIC quantity with alphabetical tie-breaks', () => {
    const aggregator = new OrganizationAggregator()
    const tiedEntries = [
      { username: 'user-beta', model: 'Model Beta', aicQuantity: 100 },
      { username: 'user-alpha', model: 'Model Alpha', aicQuantity: 100 },
    ]

    tiedEntries.forEach(({ username, model, aicQuantity }) => {
      aggregator.accumulate(createRecord({
        username,
        model,
        organization: 'octo',
        quantity: 0,
        gross_amount: 0,
        discount_amount: 0,
        net_amount: 0,
        unit_type: 'ai-credits',
        sku: 'copilot_ai_credit',
        aic_quantity: aicQuantity,
        aic_gross_amount: aicQuantity,
        aic_net_amount: aicQuantity,
      }))
    })

    for (let i = 0; i < 20; i += 1) {
      const suffix = i.toString().padStart(2, '0')
      const aicQuantity = 80 - i

      aggregator.accumulate(createRecord({
        username: `user-${suffix}`,
        model: `Model ${suffix}`,
        organization: 'octo',
        quantity: 0,
        gross_amount: 0,
        discount_amount: 0,
        net_amount: 0,
        unit_type: 'ai-credits',
        sku: 'copilot_ai_credit',
        aic_quantity: aicQuantity,
        aic_gross_amount: aicQuantity,
        aic_net_amount: aicQuantity,
      }))
    }

    aggregator.accumulate(createRecord({
      username: 'user-20',
      model: 'Model 20',
      organization: 'octo',
      quantity: 0,
      gross_amount: 0,
      discount_amount: 0,
      net_amount: 0,
      unit_type: 'ai-credits',
      sku: 'copilot_ai_credit',
      aic_quantity: 1,
      aic_gross_amount: 1,
      aic_net_amount: 1,
    }))

    aggregator.accumulate(createRecord({
      username: 'user-21',
      model: 'Model 21',
      organization: 'octo',
      quantity: 0,
      gross_amount: 0,
      discount_amount: 0,
      net_amount: 0,
      unit_type: 'ai-credits',
      sku: 'copilot_ai_credit',
      aic_quantity: 0.5,
      aic_gross_amount: 0.5,
      aic_net_amount: 0.5,
    }))

    const organization = aggregator.result().organizations.find((entry) => entry.organization === 'octo')

    expect(organization).toBeDefined()
    expect(Object.keys(organization!.totalsByModel)).toHaveLength(20)
    expect(Object.keys(organization!.totalsByUser)).toHaveLength(20)
    expect(Object.keys(organization!.totalsByModel)).toEqual([
      'Model Alpha',
      'Model Beta',
      'Model 00',
      'Model 01',
      'Model 02',
      'Model 03',
      'Model 04',
      'Model 05',
      'Model 06',
      'Model 07',
      'Model 08',
      'Model 09',
      'Model 10',
      'Model 11',
      'Model 12',
      'Model 13',
      'Model 14',
      'Model 15',
      'Model 16',
      'Model 17',
    ])
    expect(Object.keys(organization!.totalsByUser)).toEqual([
      'user-alpha',
      'user-beta',
      'user-00',
      'user-01',
      'user-02',
      'user-03',
      'user-04',
      'user-05',
      'user-06',
      'user-07',
      'user-08',
      'user-09',
      'user-10',
      'user-11',
      'user-12',
      'user-13',
      'user-14',
      'user-15',
      'user-16',
      'user-17',
    ])
    expect(organization!.totalsByModel['Model 18']).toBeUndefined()
    expect(organization!.totalsByModel['Model 20']).toBeUndefined()
    expect(organization!.totalsByUser['user-18']).toBeUndefined()
    expect(organization!.totalsByUser['user-20']).toBeUndefined()
    expect(organization!.totals.aicQuantity).toBeCloseTo(1611.5)
  })
})
