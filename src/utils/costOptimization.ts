import {
  getAicEntitlementTier,
  getIndividualPlanTier,
  IndividualAicEntitlementAllocator,
  inferReportPlanScope,
  PRO_PLUS_WEEKLY_AIC_ENTITLEMENTS,
  PRO_WEEKLY_AIC_ENTITLEMENTS,
} from '../pipeline/aicEntitlements'
import type { TokenUsageRecord } from '../pipeline/parser'

export const AIC_UNIT_PRICE_USD = 0.01
export const BUSINESS_TO_ENTERPRISE_UPGRADE_COST_USD = 20
export const BUSINESS_TO_ENTERPRISE_EXTRA_AIC = 4000
export const PRO_TO_PRO_PLUS_UPGRADE_COST_USD = 29
export const PRO_TO_PRO_PLUS_EXTRA_WEEKLY_AIC = PRO_PLUS_WEEKLY_AIC_ENTITLEMENTS - PRO_WEEKLY_AIC_ENTITLEMENTS

type SimulatedDailyUsage = {
  date: string
  aicQuantity: number
  aicGrossAmount: number
}

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
  users: Array<{
    username?: string
    totalMonthlyQuota: number
    organizations?: string[]
    costCenters?: string[]
    daily?: Record<string, SimulatedDailyUsage>
  }>
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
  const estimatedAicNetCost = roundCurrency(aicNetAmount)
  const reportPlanScope = inferReportPlanScope(
    users.length,
    users.some((user) => (user.organizations?.length ?? 0) > 0 || (user.costCenters?.length ?? 0) > 0),
  )
  const hasNetAicOverage = aicNetAmount > EPSILON
  const estimatedAicOverageCredits = roundAic(aicNetAmount / AIC_UNIT_PRICE_USD)

  if (
    reportPlanScope === 'individual'
    && users.length === 1
    && hasNetAicOverage
    && users[0].daily
    && getIndividualPlanTier(users[0].totalMonthlyQuota) === 'pro-student'
  ) {
    const simulatedAicNetCost = roundCurrency(simulateIndividualUpgradeNetCost(users[0], PRO_PLUS_WEEKLY_AIC_ENTITLEMENTS))
    const estimatedUpgradeCost = PRO_TO_PRO_PLUS_UPGRADE_COST_USD
    const estimatedAicNetCostAfterSuggestedUpgrades = roundCurrency(simulatedAicNetCost + estimatedUpgradeCost)
    const estimatedSavings = roundCurrency(Math.max(estimatedAicNetCost - estimatedAicNetCostAfterSuggestedUpgrades, 0))

    return {
      hasNetAicOverage,
      hasBusinessUsers: false,
      hasPotentialCostOptimizationOpportunity: estimatedSavings > 0,
      businessUsersAvailable: 0,
      suggestedBusinessUsersToUpgrade: 0,
      estimatedAicOverageCredits,
      estimatedAicNetCost,
      extraAicCreditsFromSuggestedUpgrades: PRO_TO_PRO_PLUS_EXTRA_WEEKLY_AIC,
      estimatedUpgradeCost,
      estimatedRemainingAicNetCost: simulatedAicNetCost,
      estimatedAicNetCostAfterSuggestedUpgrades,
      estimatedSavings,
    }
  }

  const businessUsersAvailable = users.filter(
    (user) => getAicEntitlementTier(user.totalMonthlyQuota, reportPlanScope) === 'business',
  ).length
  const hasBusinessUsers = businessUsersAvailable > 0

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

function simulateIndividualUpgradeNetCost(
  user: CostOptimizationInput['users'][number],
  weeklyEntitlements: number,
): number {
  if (!user.daily) return 0

  const allocator = new IndividualAicEntitlementAllocator(weeklyEntitlements)
  return Object.values(user.daily)
    .sort((left, right) => left.date.localeCompare(right.date))
    .reduce((total, day) => total + allocator.apply(createSimulationRecord(user.username ?? 'user', day)).aic_net_amount, 0)
}

function createSimulationRecord(username: string, day: SimulatedDailyUsage): TokenUsageRecord {
  return {
    date: day.date,
    username,
    product: 'copilot',
    sku: 'copilot_ai_unit',
    model: 'GPT-5',
    quantity: day.aicQuantity,
    unit_type: 'ai-units',
    applied_cost_per_quantity: AIC_UNIT_PRICE_USD,
    gross_amount: day.aicGrossAmount,
    discount_amount: 0,
    net_amount: day.aicGrossAmount,
    exceeds_quota: false,
    total_monthly_quota: 0,
    organization: '',
    cost_center_name: null,
    aic_quantity: day.aicQuantity,
    aic_gross_amount: day.aicGrossAmount,
    aic_net_amount: day.aicGrossAmount,
    has_aic_quantity: true,
    has_aic_gross_amount: true,
  }
}
