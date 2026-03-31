import { describe, expect, it } from 'vitest'
import { CostCenterAggregator } from './costCenterAggregator'
import { DailyUsageAggregator } from './dailyUsageAggregator'
import { ModelUsageAggregator } from './modelUsageAggregator'
import { OrganizationAggregator } from './organizationAggregator'
import { ProductUsageAggregator } from './productUsageAggregator'
import { UserUsageAggregator } from './userUsageAggregator'
import type { TokenUsageRecord } from '../parser'

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
      unit_type: 'ai-units',
      sku: 'copilot_ai_unit',
      quantity: 100,
      applied_cost_per_quantity: 0.01,
      gross_amount: 1,
      discount_amount: 0,
      net_amount: 1,
      aic_quantity: 100,
      aic_gross_amount: 1,
      aic_net_amount: 0.6,
    }),
  ]
}

function createAiOnlyFixture(): TokenUsageRecord[] {
  return [
    createRecord({
      date: '2026-03-03',
      unit_type: 'ai-units',
      sku: 'copilot_ai_unit',
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

function expectNetEquation(totals: { grossAmount: number; discountAmount: number; netAmount: number }): void {
  expect(totals.grossAmount - totals.discountAmount).toBeCloseTo(totals.netAmount)
}

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
    result.organizations.organizations.forEach(expectNetEquation)
    result.costCenters.costCenters.forEach((costCenter) => {
      expectNetEquation(costCenter.totals)
      Object.values(costCenter.totalsByModel).forEach(expectNetEquation)
    })
    Object.values(result.models.totalsByModel).forEach(expectNetEquation)
    Object.values(result.models.byModel).flat().forEach(expectNetEquation)
  })

  it('keeps PRU totals at zero for AI-unit rows in every aggregator', () => {
    const result = aggregate(createAiOnlyFixture())

    expect(result.daily.dailyData).toEqual([
      expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }),
    ])
    expect(result.users.users[0].totals).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
    expect(result.organizations.organizations[0]).toEqual(expect.objectContaining({ requests: 0, grossAmount: 0, discountAmount: 0, netAmount: 0 }))
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

    expect(result.organizations.organizations).toEqual([
      expect.objectContaining({
        organization: 'octo',
        requests: 23,
        grossAmount: 7,
        discountAmount: 1.7,
        netAmount: 5.3,
      }),
    ])
  })

  it('keeps cost-center totals aligned with per-model and per-user rollups', () => {
    const result = aggregate(createFixture())
    const cats = result.costCenters.costCenters.find((costCenter) => costCenter.costCenterName === 'Cats')

    expect(cats).toBeDefined()
    expect(cats?.totals).toEqual(expect.objectContaining({ requests: 15, grossAmount: 3, discountAmount: 0.7, netAmount: 2.3 }))
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
    expect(sumNumbers(result.models.byModel['GPT-5'].map((day) => day.grossAmount))).toBeCloseTo(result.models.totalsByModel['GPT-5'].grossAmount)
    expect(sumNumbers(result.models.byModel['GPT-5'].map((day) => day.netAmount))).toBeCloseTo(result.models.totalsByModel['GPT-5'].netAmount)
  })

  it('keeps product totals aligned with per-model breakdowns and uses friendly labels', () => {
    const result = aggregate(createFixture())

    expect(result.products.products.map((product) => product.product)).toEqual([
      'Copilot Cloud Agent',
      'Copilot',
      'Code Review',
    ])

    result.products.products.forEach((product) => {
      expect(sumNumbers(Object.values(product.models).map((model) => model.grossAmount))).toBeCloseTo(product.totals.grossAmount)
      expect(sumNumbers(Object.values(product.models).map((model) => model.netAmount))).toBeCloseTo(product.totals.netAmount)
    })

    const copilot = result.products.products.find((product) => product.product === 'Copilot')
    expect(Object.keys(copilot?.models ?? {})).toEqual(['GPT-5', 'GPT-4.1'])
  })

  it('sorts results by current implementation rules and only skips blank organization or cost center where required', () => {
    const result = aggregate(createFixture())

    expect(result.daily.dailyData.map((day) => day.date)).toEqual(['2026-03-01', '2026-03-02'])
    expect(result.users.users.map((user) => user.username)).toEqual(['hubot', 'mona'])
    expect(result.organizations.organizations.map((organization) => organization.organization)).toEqual(['octo'])
    expect(result.costCenters.costCenters.map((costCenter) => costCenter.costCenterName)).toEqual(['Cats', 'Dogs'])
    expect(result.models.models).toEqual(['Code Review model', 'Coding Agent model', 'GPT-4.1', 'GPT-5'])

    const hubot = result.users.users.find((user) => user.username === 'hubot')
    expect(hubot?.totals).toEqual(expect.objectContaining({ requests: 10, grossAmount: 5, discountAmount: 1.25, netAmount: 3.75 }))
    expect(hubot?.organizations).toEqual(['octo'])
    expect(hubot?.costCenters).toEqual(['Dogs'])
  })
})
