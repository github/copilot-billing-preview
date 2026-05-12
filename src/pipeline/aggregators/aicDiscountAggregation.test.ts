import { describe, expect, it } from 'vitest'
import type { TokenUsageRecord } from '../parser'
import { calculateAicDiscountAmount, calculateSavingsDifference } from '../../utils/billingComparison'
import { CostCenterAggregator } from './costCenterAggregator'
import { DailyUsageAggregator } from './dailyUsageAggregator'
import { ModelUsageAggregator } from './modelUsageAggregator'
import { OrganizationAggregator } from './organizationAggregator'
import { UserUsageAggregator } from './userUsageAggregator'

function createRecord(overrides: Partial<TokenUsageRecord> = {}): TokenUsageRecord {
  return {
    date: '2026-03-01',
    username: 'mona',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    model: 'GPT-5',
    quantity: 100,
    unit_type: 'ai-credits',
    applied_cost_per_quantity: 0.01,
    gross_amount: 1,
    discount_amount: 0,
    net_amount: 1,
    exceeds_quota: false,
    total_monthly_quota: 300,
    organization: 'octo',
    cost_center_name: 'Cats',
    aic_quantity: 100,
    aic_gross_amount: 1,
    aic_net_amount: 0.4,
    has_aic_quantity: true,
    has_aic_gross_amount: true,
    ...overrides,
  }
}

function aggregate(records: TokenUsageRecord[]) {
  const daily = new DailyUsageAggregator()
  const users = new UserUsageAggregator()
  const organizations = new OrganizationAggregator()
  const costCenters = new CostCenterAggregator()
  const models = new ModelUsageAggregator()
  const aggregators = [daily, users, organizations, costCenters, models]

  records.forEach((record) => {
    aggregators.forEach((aggregator) => aggregator.accumulate(record))
  })

  return {
    daily: daily.result(),
    users: users.result(),
    organizations: organizations.result(),
    costCenters: costCenters.result(),
    models: models.result(),
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

describe('derived AIC discount aggregation', () => {
  it('derives organization AIC discount as gross minus net', () => {
    const result = aggregate([createRecord({ aic_gross_amount: 1.5, aic_net_amount: 0.6 })])
    const organization = result.organizations.organizations[0]

    expect(organization.organization).toBe('octo')
    expect(organization.totals.aicGrossAmount).toBeCloseTo(1.5)
    expect(organization.totals.aicNetAmount).toBeCloseTo(0.6)
    expect(calculateAicDiscountAmount(organization.totals.aicGrossAmount, organization.totals.aicNetAmount)).toBeCloseTo(0.9)
  })

  it('derives cost-center AIC discount from totals gross minus net', () => {
    const result = aggregate([createRecord({ aic_gross_amount: 2, aic_net_amount: 0.5 })])
    const costCenter = result.costCenters.costCenters[0]

    expect(calculateAicDiscountAmount(costCenter.totals.aicGrossAmount, costCenter.totals.aicNetAmount)).toBeCloseTo(1.5)
  })

  it('keeps AIC gross and net totals consistent across organization, cost center, user, daily, and model aggregators', () => {
    const result = aggregate([
      createRecord({ aic_gross_amount: 1, aic_net_amount: 0 }),
      createRecord({ date: '2026-03-02', username: 'hubot', model: 'GPT-4.1', cost_center_name: 'Dogs', aic_gross_amount: 2, aic_net_amount: 2 }),
      createRecord({ date: '2026-03-02', username: 'mona', model: 'Code Review model', aic_gross_amount: 3, aic_net_amount: 1.2 }),
    ])

    const dailyGross = sum(result.daily.dailyData.map((day) => day.aicGrossAmount))
    const dailyNet = sum(result.daily.dailyData.map((day) => day.aicNetAmount))
    const userGross = sum(result.users.users.map((user) => user.totals.aicGrossAmount))
    const userNet = sum(result.users.users.map((user) => user.totals.aicNetAmount))
    const organizationGross = sum(result.organizations.organizations.map((organization) => organization.totals.aicGrossAmount))
    const organizationNet = sum(result.organizations.organizations.map((organization) => organization.totals.aicNetAmount))
    const costCenterGross = sum(result.costCenters.costCenters.map((costCenter) => costCenter.totals.aicGrossAmount))
    const costCenterNet = sum(result.costCenters.costCenters.map((costCenter) => costCenter.totals.aicNetAmount))
    const modelGross = sum(Object.values(result.models.totalsByModel).map((model) => model.aicGrossAmount))
    const modelNet = sum(Object.values(result.models.totalsByModel).map((model) => model.aicNetAmount))

    expect(dailyGross).toBeCloseTo(6)
    expect(dailyNet).toBeCloseTo(3.2)
    expect(userGross).toBeCloseTo(dailyGross)
    expect(userNet).toBeCloseTo(dailyNet)
    expect(organizationGross).toBeCloseTo(dailyGross)
    expect(organizationNet).toBeCloseTo(dailyNet)
    expect(costCenterGross).toBeCloseTo(dailyGross)
    expect(costCenterNet).toBeCloseTo(dailyNet)
    expect(modelGross).toBeCloseTo(dailyGross)
    expect(modelNet).toBeCloseTo(dailyNet)
  })

  it('derives displayed savings from PRU net minus AIC net totals', () => {
    const result = aggregate([
      createRecord({
        unit_type: 'requests',
        sku: 'copilot_premium_request',
        quantity: 10,
        gross_amount: 4,
        discount_amount: 1,
        net_amount: 3,
        aic_quantity: 100,
        aic_gross_amount: 1,
        aic_net_amount: 0.25,
      }),
    ])
    const organization = result.organizations.organizations[0]

    expect(calculateSavingsDifference(organization.totals.netAmount, organization.totals.aicNetAmount)).toBeCloseTo(2.75)
  })
})
