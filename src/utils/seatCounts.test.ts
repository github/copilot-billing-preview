import { describe, expect, it } from 'vitest'
import { getSeatCountInputError, parseSeatCountInput } from './seatCounts'

describe('seat count helpers', () => {
  it('parses only explicit whole-number seat counts', () => {
    expect(parseSeatCountInput('10')).toBe(10)
    expect(parseSeatCountInput(' 12 ')).toBe(12)
    expect(parseSeatCountInput('')).toBeNull()
    expect(parseSeatCountInput('  ')).toBeNull()
    expect(parseSeatCountInput('12.9')).toBeNull()
    expect(parseSeatCountInput('not-a-number')).toBeNull()
  })

  it('requires a whole-number seat count at or above the historical count', () => {
    const invalidInputError = 'Enter a whole number greater than or equal to 10 because that count comes from historical report data.'

    expect(getSeatCountInputError('', 10)).toBe(invalidInputError)
    expect(getSeatCountInputError('  ', 10)).toBe(invalidInputError)
    expect(getSeatCountInputError('12.9', 10)).toBe(invalidInputError)
    expect(getSeatCountInputError('not-a-number', 10)).toBe(invalidInputError)
    expect(getSeatCountInputError('10', 10)).toBeNull()
    expect(getSeatCountInputError(' 12 ', 10)).toBeNull()
    expect(getSeatCountInputError('12', 10)).toBeNull()
    expect(getSeatCountInputError('8', 10)).toBe('Cannot go below 10 because that count comes from historical report data.')
  })
})
