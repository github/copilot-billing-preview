import { describe, expect, it } from 'vitest'

import { getUsageMetrics, type TokenUsageRecord } from '../parser'
import { getAggregatorUsageMetrics } from './usageMetrics'

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
    cost_center_name: 'Cost Center A',
    aic_quantity: 100,
    aic_gross_amount: 1,
    aic_net_amount: 0.6,
    has_aic_quantity: true,
    has_aic_gross_amount: true,
    ...overrides,
  }
}

describe('getAggregatorUsageMetrics', () => {
  it('preserves transition-period parser usage metric semantics for request and AI Credits rows', () => {
    const records = [
      createRecord(),
      createRecord({
        unit_type: 'ai-credits',
        sku: 'copilot_ai_credit',
        quantity: 50,
        gross_amount: 0.5,
        discount_amount: 0.1,
        net_amount: 0.4,
        aic_quantity: 50,
        aic_gross_amount: 0.5,
        aic_net_amount: 0.2,
      }),
      createRecord({
        unit_type: 'ai-credits',
        sku: 'copilot_ai_credit',
        quantity: 25,
        gross_amount: 0.25,
        discount_amount: 0,
        net_amount: 0.25,
        aic_quantity: 0,
        aic_gross_amount: 0,
        aic_net_amount: 0.25,
        has_aic_quantity: false,
        has_aic_gross_amount: false,
      }),
    ]

    records.forEach((record) => {
      expect(getAggregatorUsageMetrics(record)).toEqual(getUsageMetrics(record))
      expect(getAggregatorUsageMetrics(record, 'transition-period-billing-preview')).toEqual(getUsageMetrics(record))
    })
  })

  it('maps native AI Credits metrics into aic output fields and leaves PRU comparison fields at zero', () => {
    const record = createRecord({
      unit_type: 'ai-credits',
      sku: 'copilot_ai_credit',
      quantity: 12.5,
      gross_amount: 0.125,
      discount_amount: 0.025,
      net_amount: 0.1,
      aic_quantity: 12.5,
      aic_gross_amount: 0.125,
      aic_net_amount: 0.1,
    })

    expect(getAggregatorUsageMetrics(record, 'native-ai-credits')).toEqual({
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: 12.5,
      aicGrossAmount: 0.125,
      aicNetAmount: 0.1,
    })
  })
})
