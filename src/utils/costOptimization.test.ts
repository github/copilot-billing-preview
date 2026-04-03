import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TO_ENTERPRISE_EXTRA_AIC,
  calculateCostOptimizationOpportunity,
  PRO_TO_PRO_PLUS_EXTRA_WEEKLY_AIC,
  PRO_TO_PRO_PLUS_UPGRADE_COST_USD,
} from './costOptimization'

function createDaily(date: string, aicQuantity: number, aicGrossAmount: number) {
  return { date, aicQuantity, aicGrossAmount }
}

describe('cost optimization opportunity helpers', () => {
  it('does not flag an opportunity when there is no AIC overage', () => {
    expect(calculateCostOptimizationOpportunity({
      aicNetAmount: 0,
      users: [{ totalMonthlyQuota: 300 }],
    })).toEqual({
      hasNetAicOverage: false,
      hasBusinessUsers: false,
      hasPotentialCostOptimizationOpportunity: false,
      businessUsersAvailable: 0,
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
    expect(opportunity.hasBusinessUsers).toBe(false)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(0)
    expect(opportunity.estimatedAicOverageCredits).toBe(2000)
    expect(opportunity.estimatedSavings).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(20)
  })

  it('does not recommend an upgrade when the next step saves less than one cent', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 20.009,
      users: [{ totalMonthlyQuota: 300 }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(false)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(0)
    expect(opportunity.estimatedSavings).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(20.01)
  })

  it('does not treat a single-user 300 PRU report as an upgradeable Business report', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 60,
      users: [{ totalMonthlyQuota: 300 }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(false)
    expect(opportunity.businessUsersAvailable).toBe(0)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
  })

  it('treats a single-user 300 PRU report with organization metadata as a Business report', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 60,
      users: [{ totalMonthlyQuota: 300, organizations: ['example-org'], costCenters: ['Cost Center A'] }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(true)
    expect(opportunity.businessUsersAvailable).toBe(1)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(true)
    expect(opportunity.suggestedBusinessUsersToUpgrade).toBe(1)
  })

  it('recommends upgrading an individual Pro user to Pro+ when simulated weekly coverage saves money', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 64,
      users: [{
        username: 'mona',
        totalMonthlyQuota: 300,
        daily: {
          '2026-03-02': createDaily('2026-03-02', 5000, 50),
          '2026-03-09': createDaily('2026-03-09', 5000, 50),
        },
      }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasBusinessUsers).toBe(false)
    expect(opportunity.businessUsersAvailable).toBe(0)
    expect(opportunity.extraAicCreditsFromSuggestedUpgrades).toBe(PRO_TO_PRO_PLUS_EXTRA_WEEKLY_AIC)
    expect(opportunity.estimatedUpgradeCost).toBe(PRO_TO_PRO_PLUS_UPGRADE_COST_USD)
    expect(opportunity.estimatedRemainingAicNetCost).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(29)
    expect(opportunity.estimatedSavings).toBe(35)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(true)
  })

  it('does not recommend Pro+ when the individual upgrade cost outweighs the simulated savings', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 22,
      users: [{
        username: 'mona',
        totalMonthlyQuota: 300,
        daily: {
          '2026-03-02': createDaily('2026-03-02', 4000, 40),
        },
      }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.extraAicCreditsFromSuggestedUpgrades).toBe(PRO_TO_PRO_PLUS_EXTRA_WEEKLY_AIC)
    expect(opportunity.estimatedUpgradeCost).toBe(PRO_TO_PRO_PLUS_UPGRADE_COST_USD)
    expect(opportunity.estimatedRemainingAicNetCost).toBe(0)
    expect(opportunity.estimatedAicNetCostAfterSuggestedUpgrades).toBe(29)
    expect(opportunity.estimatedSavings).toBe(0)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
  })

  it('does not recommend a higher tier for a user already on Pro+', () => {
    const opportunity = calculateCostOptimizationOpportunity({
      aicNetAmount: 30,
      users: [{
        username: 'mona',
        totalMonthlyQuota: 1500,
        daily: {
          '2026-03-02': createDaily('2026-03-02', 8000, 80),
        },
      }],
    })

    expect(opportunity.hasNetAicOverage).toBe(true)
    expect(opportunity.hasPotentialCostOptimizationOpportunity).toBe(false)
    expect(opportunity.estimatedUpgradeCost).toBe(0)
    expect(opportunity.estimatedSavings).toBe(0)
  })
})
