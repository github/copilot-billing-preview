import { describe, expect, it } from 'vitest'
import {
  calculateCostOptimizationOpportunity,
  BUSINESS_TO_ENTERPRISE_EXTRA_AIC,
} from './costOptimization'

describe('cost optimization opportunity helpers', () => {
  it('does not flag an opportunity when there is no AIC overage', () => {
    expect(calculateCostOptimizationOpportunity({
      aicNetAmount: 0,
      users: [{ totalMonthlyQuota: 300 }],
    })).toEqual({
      hasNetAicOverage: false,
      hasBusinessUsers: true,
      hasPotentialCostOptimizationOpportunity: false,
      businessUsersAvailable: 1,
      suggestedBusinessUsersToUpgrade: 0,
      estimatedAicOverageCredits: 0,
      estimatedAicNetCost: 0,
      extraAicCreditsFromSuggestedUpgrades: 0,
      estimatedUpgradeCost: 0,
      estimatedRemainingAicNetCost: 0,
      estimatedAicNetCostAfterSuggestedUpgrades: 0,
      estimatedSavings: 0,
    })
  })

  it('does not flag an opportunity when there are no business users to upgrade', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 60,
      users: [{ totalMonthlyQuota: 1000 }, { totalMonthlyQuota: 1000 }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(false)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(0)
    expect(opportunity.estimatedSavings).toBe(0)
  })

  it('recommends the minimum number of upgrades that produce positive savings', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 60,
      users: [{ totalMonthlyQuota: 300 }, { totalMonthlyQuota: 300 }],
    })

    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(true)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(1)
    expect(opportunity.extraAicCreditsFromSuggestedUpgrades).toBe(BUSINESS_TO_ENTERPRISE_EXTRA_AIC)
    expect(opportunity.estimatedUpgradeCost).toBe(20)
    expect(opportunity.estimatedRemainingAicNetCost).toBe(20)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(40)
    expect(opportunity.estimatedSavings).toBe(20)
  })

  it('stops recommending upgrades once the next one would not save money', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 150,
      users: [
        { totalMonthlyQuota: 300 },
        { totalMonthlyQuota: 300 },
        { totalMonthlyQuota: 300 },
        { totalMonthlyQuota: 300 },
        { totalMonthlyQuota: 300 },
      ],
    })

    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(4)
    expect(opportunity.extraAicCreditsFromSuggestedUpgrades).toBe(16000)
    expect(opportunity.estimatedUpgradeCost).toBe(80)
    expect(opportunity.estimatedRemainingAicNetCost).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(80)
    expect(opportunity.estimatedSavings).toBe(70)
  })

  it('does not recommend an upgrade when extra credits would offset too little overage', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 20,
      users: [{ totalMonthlyQuota: 300 }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(true)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(0)
    expect(opportunity.estimatedAicOverageCredits).toBe(2000)
    expect(opportunity.estimatedSavings).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(20)
  })
})
