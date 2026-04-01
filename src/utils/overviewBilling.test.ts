import { describe, expect, it } from 'vitest'
import { calculateOverviewAicDiscountRate } from './overviewBilling'

describe('overview billing helpers', () => {
  it('returns 0 when there is no daily usage data', () => {
    expect(calculateOverviewAicDiscountRate([], 50)).toBe(0)
  })

  it('caps the discount rate at 1 when credits exceed total usage', () => {
    expect(calculateOverviewAicDiscountRate([
      {
        date: '2026-03-01',
        requests: 10,
        aicQuantity: 20,
        grossAmount: 1,
        aicGrossAmount: 0.2,
        aicNetAmount: 0,
        discountAmount: 1,
        netAmount: 0,
      },
    ], 30)).toBe(1)
  })

  it('returns the proportional coverage ratio for partial credits', () => {
    expect(calculateOverviewAicDiscountRate([
      {
        date: '2026-03-01',
        requests: 10,
        aicQuantity: 20,
        grossAmount: 1,
        aicGrossAmount: 0.2,
        aicNetAmount: 0.1,
        discountAmount: 0.5,
        netAmount: 0.5,
      },
      {
        date: '2026-03-02',
        requests: 5,
        aicQuantity: 10,
        grossAmount: 0.5,
        aicGrossAmount: 0.1,
        aicNetAmount: 0.05,
        discountAmount: 0.25,
        netAmount: 0.25,
      },
    ], 15)).toBeCloseTo(0.5)
  })
})
