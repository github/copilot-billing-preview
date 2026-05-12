import { describe, expect, it } from 'vitest'
import type { TokenUsageRecord } from '../parser'
import { ReportContextAggregator } from './reportContextAggregator'

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

function aggregate(records: TokenUsageRecord[]) {
  const aggregator = new ReportContextAggregator()
  records.forEach((record) => aggregator.accumulate(record))
  return aggregator.result()
}

describe('report context aggregation', () => {
  it('collects unique products, SKUs, and unit types while ignoring blank SKUs and preserving unknown ones', () => {
    const result = aggregate([
      createRecord(),
      createRecord({ product: 'spark', sku: 'copilot_ai_credit', unit_type: 'ai-credits' }),
      createRecord({ product: 'copilot', sku: 'mystery_sku', unit_type: 'requests' }),
      createRecord({ sku: '' }),
    ])

    expect(result.products).toEqual(['copilot', 'spark'])
    expect(result.skus).toEqual(['copilot_ai_credit', 'copilot_premium_request', 'mystery_sku'])
    expect(result.unitTypes).toEqual(['ai-credits', 'requests'])
  })

  it('derives the reporting range from the lexicographically smallest and largest valid ISO dates only', () => {
    const result = aggregate([
      createRecord({ date: '2026-03-15' }),
      createRecord({ date: '2026-03-01' }),
      createRecord({ date: '2026-03-31' }),
      createRecord({ date: '03/20/2026' }),
      createRecord({ date: '2026-13-01' }),
      createRecord({ date: '2026-02-30' }),
      createRecord({ date: 'not-a-date' }),
    ])

    expect(result.startDate).toBe('2026-03-01')
    expect(result.endDate).toBe('2026-03-31')
  })
})
