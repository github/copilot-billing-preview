import { describe, expect, it } from 'vitest'
import { calculateAicDiscountAmount, calculateSavingsDifference } from './billingComparison'

describe('billing comparison helpers', () => {
  it('derives AIC discount as gross minus net for fully covered usage', () => {
    expect(calculateAicDiscountAmount(1.2, 0)).toBeCloseTo(1.2)
  })

  it('derives AIC discount as 0 for uncovered usage', () => {
    expect(calculateAicDiscountAmount(1.2, 1.2)).toBeCloseTo(0)
  })

  it('derives AIC discount as only the covered portion for partial usage', () => {
    expect(calculateAicDiscountAmount(1.2, 0.45)).toBeCloseTo(0.75)
  })

  it('derives displayed savings as PRU net minus AIC net', () => {
    expect(calculateSavingsDifference(5.3, 1.1)).toBeCloseTo(4.2)
  })
})
