import { describe, expect, it } from 'vitest'
import { getSeatReductionError, parseSeatCountInput } from './seatCounts'

describe('seat count helpers', () => {
  it('normalizes seat count input to the historical minimum', () => {
    expect(parseSeatCountInput('', 10)).toBe(10)
    expect(parseSeatCountInput('12.9', 10)).toBe(12)
    expect(parseSeatCountInput('not-a-number', 10)).toBe(10)
    expect(parseSeatCountInput('8', 10)).toBe(10)
  })

  it('reports only reductions below the historical count', () => {
    expect(getSeatReductionError('', 10)).toBeNull()
    expect(getSeatReductionError('10', 10)).toBeNull()
    expect(getSeatReductionError('12', 10)).toBeNull()
    expect(getSeatReductionError('8', 10)).toBe('Cannot go below 10 because that count comes from historical report data.')
  })
})
