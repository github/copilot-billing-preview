import { describe, expect, it } from 'vitest'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { calculateUserSpendInsights, classifyUserSpendSegments } from './userSpendSegments'

function createUser(username: string, aicGrossAmount: number): UserUsage {
    return {
      username,
      spendSegment: 'near-zero',
      totalMonthlyQuota: 1000,
    organizations: ['example-org'],
    costCenters: ['Cost Center A'],
    daily: {},
    products: {},
    totals: {
      requests: 0,
      grossAmount: 0,
      discountAmount: 0,
      netAmount: 0,
      aicQuantity: aicGrossAmount * 100,
      aicGrossAmount,
      aicNetAmount: aicGrossAmount,
      distinctModels: 1,
    },
  }
}

describe('calculateUserSpendInsights', () => {
  it('calculates spend concentration from AIC gross cost', () => {
    const insights = calculateUserSpendInsights([
      createUser('mona', 100),
      createUser('octocat', 50),
      createUser('hubot', 20),
      createUser('test-user', 5),
      createUser('ghost', 0),
    ])

    expect(insights.totalUsers).toBe(5)
    expect(insights.totalAicGrossAmount).toBe(175)
    expect(insights.topUsers.map((user) => user.username)).toEqual(['mona', 'octocat', 'hubot', 'test-user'])
    expect(insights.topUserShare).toBeCloseTo(100 / 175)
    expect(insights.topUsersShare).toBe(1)
    expect(insights.top10PercentUserCount).toBe(1)
    expect(insights.top10PercentShare).toBeCloseTo(100 / 175)
    expect(insights.concentrationHeadline).toBe('The top 10% of users (1 user) account for 57% of AIC gross cost.')
  })

  it('groups positive users into explainable percentile segments', () => {
    const users = Array.from({ length: 20 }, (_, index) => createUser(`test-user-${index + 1}`, 20 - index))
    const classifiedUsers = [...users, createUser('near-zero-user', 0)]
    const spendSegments = classifyUserSpendSegments(classifiedUsers)
    classifiedUsers.forEach((user) => {
      user.spendSegment = spendSegments.get(user.username) ?? 'near-zero'
    })
    const insights = calculateUserSpendInsights(classifiedUsers)

    expect(insights.segments.map((segment) => [segment.id, segment.userCount])).toEqual([
      ['power', 1],
      ['heavy', 3],
      ['typical', 11],
      ['light', 5],
      ['near-zero', 1],
    ])
    expect(insights.segments[0]).toMatchObject({
      id: 'power',
      totalAicGrossAmount: 20,
      averageAicGrossAmount: 20,
      medianAicGrossAmount: 20,
    })
  })

  it('bases the top ten percent concentration on users with AIC gross cost', () => {
    const insights = calculateUserSpendInsights([
      createUser('mona', 100),
      createUser('octocat', 50),
      ...Array.from({ length: 98 }, (_, index) => createUser(`near-zero-user-${index + 1}`, 0)),
    ])

    expect(insights.totalUsers).toBe(100)
    expect(insights.positiveUserCount).toBe(2)
    expect(insights.top10PercentUserCount).toBe(1)
    expect(insights.top10PercentShare).toBeCloseTo(100 / 150)
    expect(insights.concentrationHeadline).toBe('The top 10% of users (1 user) account for 67% of AIC gross cost.')
  })

  it('classifies users once so each report user can keep their spend segment', () => {
    const users = Array.from({ length: 20 }, (_, index) => createUser(`test-user-${index + 1}`, 20 - index))
    const nearZeroUser = createUser('near-zero-user', 0)
    const spendSegments = classifyUserSpendSegments([...users, nearZeroUser])

    expect(spendSegments.get('test-user-1')).toBe('power')
    expect(spendSegments.get('test-user-2')).toBe('heavy')
    expect(spendSegments.get('test-user-5')).toBe('typical')
    expect(spendSegments.get('test-user-16')).toBe('light')
    expect(spendSegments.get('near-zero-user')).toBe('near-zero')
  })

  it('handles reports without AIC gross cost', () => {
    const insights = calculateUserSpendInsights([
      createUser('mona', 0),
      createUser('octocat', 0),
    ])

    expect(insights.topUsers).toEqual([])
    expect(insights.top10PercentUserCount).toBe(0)
    expect(insights.top10PercentShare).toBe(0)
    expect(insights.concentrationHeadline).toBe('No AIC gross cost was found in this report.')
    expect(insights.segments.find((segment) => segment.id === 'near-zero')?.userCount).toBe(2)
  })
})
