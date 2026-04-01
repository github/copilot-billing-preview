import { getAicEntitlementTier } from '../pipeline/aicEntitlements'

export const AIC_UNIT_PRICE_USD = 0.01
export const BUSINESS_TO_ENTERPRISE_UPGRADE_COST_USD = 20
export const BUSINESS_TO_ENTERPRISE_EXTRA_AIC = 4000

export type CostOptimizationOpportunity = {
  hasNetAicOverage: boolean
  hasBusinessUsers: boolean
  hasPotentialCostOptimizationOpportunity: boolean
  businessUsersAvailable: number
  suggestedBusinessUsersToUpgrade: number
  estimatedAicOverageCredits: number
  estimatedAicNetCost: number
  extraAicCreditsFromSuggestedUpgrades: number
  estimatedUpgradeCost: number
  estimatedRemainingAicNetCost: number
  estimatedAicNetCostAfterSuggestedUpgrades: number
  estimatedSavings: number
}

type CostOptimizationInput = {
  aicNetAmount: number
  users: Array<{ totalMonthlyQuota: number }>
}

const EPSILON = 1e-9

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function roundAic(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function calculateCostOptimizationOpportunity({
  aicNetAmount,
  users,
}: CostOptimizationInput): CostOptimizationOpportunity {
  const businessUsersAvailable = users.filter((user) => getAicEntitlementTier(user.totalMonthlyQuota) === 'business').length
  const hasNetAicOverage = aicNetAmount > EPSILON
  const hasBusinessUsers = businessUsersAvailable > 0
  const estimatedAicOverageCredits = roundAic(aicNetAmount / AIC_UNIT_PRICE_USD)
  const estimatedAicNetCost = roundCurrency(aicNetAmount)

  let suggestedBusinessUsersToUpgrade = 0
  let estimatedSavings = 0
  let remainingAicOverageCredits = estimatedAicOverageCredits

  while (suggestedBusinessUsersToUpgrade < businessUsersAvailable) {
    const recoveredAicCredits = Math.min(remainingAicOverageCredits, BUSINESS_TO_ENTERPRISE_EXTRA_AIC)
    const incrementalSavings = (recoveredAicCredits * AIC_UNIT_PRICE_USD) - BUSINESS_TO_ENTERPRISE_UPGRADE_COST_USD

    if (incrementalSavings < 0.01) {
      break
    }

    suggestedBusinessUsersToUpgrade += 1
    estimatedSavings += incrementalSavings
    remainingAicOverageCredits = roundAic(Math.max(remainingAicOverageCredits - BUSINESS_TO_ENTERPRISE_EXTRA_AIC, 0))
  }

  const extraAicCreditsFromSuggestedUpgrades = suggestedBusinessUsersToUpgrade * BUSINESS_TO_ENTERPRISE_EXTRA_AIC
  const estimatedUpgradeCost = roundCurrency(suggestedBusinessUsersToUpgrade * BUSINESS_TO_ENTERPRISE_UPGRADE_COST_USD)
  const estimatedRemainingAicNetCost = roundCurrency(remainingAicOverageCredits * AIC_UNIT_PRICE_USD)
  const estimatedAicNetCostAfterSuggestedUpgrades = roundCurrency(estimatedRemainingAicNetCost + estimatedUpgradeCost)
  const roundedEstimatedSavings = roundCurrency(estimatedSavings)
  const hasPotentialCostOptimizationOpportunity = roundedEstimatedSavings > 0

  return {
    hasNetAicOverage,
    hasBusinessUsers,
    hasPotentialCostOptimizationOpportunity,
    businessUsersAvailable,
    suggestedBusinessUsersToUpgrade,
    estimatedAicOverageCredits,
    estimatedAicNetCost,
    extraAicCreditsFromSuggestedUpgrades,
    estimatedUpgradeCost,
    estimatedRemainingAicNetCost,
    estimatedAicNetCostAfterSuggestedUpgrades,
    estimatedSavings: roundedEstimatedSavings,
  }
}
