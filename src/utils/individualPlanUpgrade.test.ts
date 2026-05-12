import { describe, expect, it } from 'vitest'

import { PRO_MONTHLY_QUOTA, PRO_PLUS_MONTHLY_QUOTA } from '../pipeline/aicIncludedCredits'
import {
  calculateIndividualPlanUpgradeRecommendation,
  getIndividualLicenseMonthlyCost,
  MAX_LICENSE_MONTHLY_COST,
  PRO_LICENSE_MONTHLY_COST,
  PRO_PLUS_LICENSE_MONTHLY_COST,
} from './individualPlanUpgrade'

describe('individual plan upgrade recommendations', () => {
  it('returns individual plan license costs', () => {
    expect(getIndividualLicenseMonthlyCost(PRO_MONTHLY_QUOTA)).toBe(PRO_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(PRO_PLUS_MONTHLY_QUOTA)).toBe(PRO_PLUS_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(0)).toBeUndefined()
  })

  it('recommends Pro+ when extra included AICs exceed the higher subscription cost', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [70],
    })

    expect(recommendation).toEqual({
      currentPlanLabel: 'Pro',
      nextPlanTier: 'pro-plus',
      nextPlanLabel: 'Pro+',
      currentAdditionalUsageAic: 7000,
      currentAdditionalUsageCostUsd: 70,
      extraIncludedAic: 5500,
      additionalUsageBillReductionUsd: 55,
      licenseCostIncreaseUsd: 29,
      netSavingsUsd: 26,
      upgradedTotalBillUsd: 54,
    })
  })

  it('does not recommend upgrading when Pro+ would not reduce the total bill', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [29],
    })).toBeNull()
  })

  it('recommends Max from Pro+ when it reduces the total bill', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_PLUS_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [100],
    })

    expect(recommendation).toEqual({
      currentPlanLabel: 'Pro+',
      nextPlanTier: 'max',
      nextPlanLabel: 'Max',
      currentAdditionalUsageAic: 10000,
      currentAdditionalUsageCostUsd: 100,
      extraIncludedAic: 13000,
      additionalUsageBillReductionUsd: 100,
      licenseCostIncreaseUsd: 61,
      netSavingsUsd: 39,
      upgradedTotalBillUsd: MAX_LICENSE_MONTHLY_COST,
    })
  })

  it('applies the extra included AICs and subscription increase per month', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [70, 20],
    })

    expect(recommendation?.currentAdditionalUsageAic).toBe(9000)
    expect(recommendation?.additionalUsageBillReductionUsd).toBe(75)
    expect(recommendation?.licenseCostIncreaseUsd).toBe(58)
    expect(recommendation?.netSavingsUsd).toBe(17)
    expect(recommendation?.upgradedTotalBillUsd).toBe(93)
  })

  it('recommends Max from Pro when it saves more than Pro+', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [200],
    })

    expect(recommendation?.nextPlanLabel).toBe('Max')
    expect(recommendation?.extraIncludedAic).toBe(18500)
    expect(recommendation?.additionalUsageBillReductionUsd).toBe(185)
    expect(recommendation?.licenseCostIncreaseUsd).toBe(90)
    expect(recommendation?.netSavingsUsd).toBe(95)
    expect(recommendation?.upgradedTotalBillUsd).toBe(115)
  })

  it('does not recommend Max from Pro+ when it would not reduce the total bill', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_PLUS_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [61],
    })).toBeNull()
  })
})
