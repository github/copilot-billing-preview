import { calculateAicIncludedCreditsContext, getUsageMonthKey, type AicIncludedCreditsContext, type AicIncludedCreditsOverrides } from '../pipeline/aicIncludedCredits'
import { getAicUsageMetrics, getUsageMetrics, parseNormalizedTokenUsageRecord, parseTokenUsageHeader, type TokenUsageHeader, type TokenUsageRecord } from '../pipeline/parser'
import { getProductBudgetName, isNonCopilotCodeReviewUsage, NON_COPILOT_CODE_REVIEW_USER_LABEL, type ProductBudgetName } from '../pipeline/productClassification'
import { streamLines } from '../pipeline/streamer'

export type BudgetSimulationResult = {
  totalBill: number
  blockedUsers: number
  blockedRequests: number
  blockedIncludedCreditsAic: number
  budgetExhausted: boolean
  firstUserBlockedDate: string | null
  accountBlockedDate: string | null
  productBlockedDates: Partial<Record<ProductBudgetName, string>>
  adjustedDailyNetCostByDate: Array<{ date: string; amount: number }>
}

export type BudgetSimulationOptions = {
  accountBudgetUsd?: number
  userBudgetUsd?: number
  productBudgetsUsd?: Partial<Record<ProductBudgetName, number>>
}

type BudgetSimulationContext = Pick<AicIncludedCreditsContext, 'reportPlanScope' | 'organizationIncludedCreditsPool' | 'individualMonthlyIncludedCredits'>
type BudgetSimulationState = {
  remainingAccountBudget: number
  userBudgetCap: number
  remainingProductBudgetByName: Map<ProductBudgetName, number>
  remainingOrganizationIncludedCredits: number
  totalBill: number
  blockedRequests: number
  budgetExhausted: boolean
  firstUserBlockedDate: string | null
  accountBlockedDate: string | null
  productBlockedDates: Partial<Record<ProductBudgetName, string>>
  blockedUsers: Set<string>
  adjustedDailyNetCostByDate: Map<string, number>
  remainingUserBudgetByUser: Map<string, number>
  remainingMonthlyIncludedCredits: Map<string, number>
  seenIndividualIncludedCreditKeys: Set<string>
}

function normalizeBudget(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return Number.POSITIVE_INFINITY
  return Math.max(value, 0)
}

function getMaxQuantityByAdditionalSpendBudget(
  aicQuantity: number,
  remainingIncludedCredits: number,
  remainingBudgetUsd: number,
  costPerAic: number,
): number {
  if (remainingBudgetUsd === Number.POSITIVE_INFINITY) {
    return aicQuantity
  }

  return Math.min(aicQuantity, remainingIncludedCredits + (remainingBudgetUsd / costPerAic))
}

function getIndividualIncludedCreditKey(record: TokenUsageRecord): string | null {
  const username = record.username.trim()
  const monthKey = getUsageMonthKey(record.date.trim())
  if (!username || !monthKey) {
    return null
  }

  return `${username}\u0000${monthKey}`
}

function getBudgetSubject(record: TokenUsageRecord): string | null {
  const username = record.username.trim()
  if (username) {
    return username
  }

  if (isNonCopilotCodeReviewUsage(record)) {
    return NON_COPILOT_CODE_REVIEW_USER_LABEL
  }

  return null
}

function createBudgetSimulationState(
  options: BudgetSimulationOptions,
  context: BudgetSimulationContext,
): BudgetSimulationState {
  return {
    remainingAccountBudget: normalizeBudget(options.accountBudgetUsd),
    userBudgetCap: normalizeBudget(options.userBudgetUsd),
    remainingProductBudgetByName: new Map<ProductBudgetName, number>(Object.entries(options.productBudgetsUsd ?? {})
      .map(([name, amount]) => [name as ProductBudgetName, normalizeBudget(amount)])),
    remainingOrganizationIncludedCredits: context.organizationIncludedCreditsPool,
    totalBill: 0,
    blockedRequests: 0,
    budgetExhausted: false,
    firstUserBlockedDate: null,
    accountBlockedDate: null,
    productBlockedDates: {},
    blockedUsers: new Set<string>(),
    adjustedDailyNetCostByDate: new Map<string, number>(),
    remainingUserBudgetByUser: new Map<string, number>(),
    remainingMonthlyIncludedCredits: new Map<string, number>(),
    seenIndividualIncludedCreditKeys: new Set<string>(),
  }
}

function getRemainingIncludedCredits(
  record: TokenUsageRecord,
  context: BudgetSimulationContext,
  remainingOrganizationIncludedCredits: number,
  remainingMonthlyIncludedCredits: Map<string, number>,
): number {
  if (context.reportPlanScope === 'organization') {
    return remainingOrganizationIncludedCredits
  }

  const key = getIndividualIncludedCreditKey(record)
  if (!key) {
    return 0
  }

  return remainingMonthlyIncludedCredits.get(key) ?? context.individualMonthlyIncludedCredits
}

function setRemainingIncludedCredits(
  record: TokenUsageRecord,
  context: BudgetSimulationContext,
  coveredQuantity: number,
  remainingMonthlyIncludedCredits: Map<string, number>,
  currentRemainingOrganizationIncludedCredits: number,
): number {
  if (context.reportPlanScope === 'organization') {
    return Math.max(currentRemainingOrganizationIncludedCredits - coveredQuantity, 0)
  }

  const key = getIndividualIncludedCreditKey(record)
  if (!key) {
    return currentRemainingOrganizationIncludedCredits
  }

  const remaining = remainingMonthlyIncludedCredits.get(key) ?? context.individualMonthlyIncludedCredits
  remainingMonthlyIncludedCredits.set(key, Math.max(remaining - coveredQuantity, 0))
  return currentRemainingOrganizationIncludedCredits
}

function simulateBudgetRecord(
  state: BudgetSimulationState,
  record: TokenUsageRecord,
  context: BudgetSimulationContext,
): void {
    const budgetSubject = getBudgetSubject(record)
    const productBudgetName = getProductBudgetName(record)
    const { requests } = getUsageMetrics(record)
    const { aicQuantity, aicGrossAmount } = getAicUsageMetrics(record)
    if (aicQuantity <= 0 || aicGrossAmount <= 0) {
      return
    }

    const costPerAic = aicGrossAmount / aicQuantity
    if (!Number.isFinite(costPerAic) || costPerAic <= 0) {
      return
    }

    if (context.reportPlanScope !== 'organization') {
      const individualIncludedCreditKey = getIndividualIncludedCreditKey(record)
      if (individualIncludedCreditKey) {
        state.seenIndividualIncludedCreditKeys.add(individualIncludedCreditKey)
      }
    }

    const remainingUserBudget = state.userBudgetCap === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : (budgetSubject ? (state.remainingUserBudgetByUser.get(budgetSubject) ?? state.userBudgetCap) : Number.POSITIVE_INFINITY)
    const remainingProductBudget = state.remainingProductBudgetByName.get(productBudgetName) ?? Number.POSITIVE_INFINITY
    const remainingIncludedCredits = getRemainingIncludedCredits(
      record,
      context,
      state.remainingOrganizationIncludedCredits,
      state.remainingMonthlyIncludedCredits,
    )

    const maxQuantityByUserBudget = remainingUserBudget === Number.POSITIVE_INFINITY
      ? aicQuantity
      : Math.min(aicQuantity, remainingUserBudget / costPerAic)
    const maxQuantityByAccountBudget = getMaxQuantityByAdditionalSpendBudget(
      aicQuantity,
      remainingIncludedCredits,
      state.remainingAccountBudget,
      costPerAic,
    )
    const maxQuantityByProductBudget = getMaxQuantityByAdditionalSpendBudget(
      aicQuantity,
      remainingIncludedCredits,
      remainingProductBudget,
      costPerAic,
    )
    const allowedQuantity = Math.max(0, Math.min(aicQuantity, maxQuantityByUserBudget, maxQuantityByAccountBudget, maxQuantityByProductBudget))
    const allowedRatio = allowedQuantity / aicQuantity
    const userBudgetLimited = maxQuantityByUserBudget < aicQuantity
      && maxQuantityByUserBudget <= maxQuantityByAccountBudget
      && maxQuantityByUserBudget <= maxQuantityByProductBudget
    const accountBudgetLimited = maxQuantityByAccountBudget < aicQuantity
      && maxQuantityByAccountBudget <= maxQuantityByUserBudget
      && maxQuantityByAccountBudget <= maxQuantityByProductBudget
    const productBudgetLimited = maxQuantityByProductBudget < aicQuantity
      && maxQuantityByProductBudget <= maxQuantityByUserBudget
      && maxQuantityByProductBudget <= maxQuantityByAccountBudget

    if (allowedRatio < 1) {
      state.blockedRequests += requests * (1 - allowedRatio)
      if (budgetSubject) {
        state.blockedUsers.add(budgetSubject)
      }
      if (userBudgetLimited && state.firstUserBlockedDate === null) {
        state.firstUserBlockedDate = record.date || null
      }
    }

    if (allowedQuantity <= 0) {
      if (state.remainingAccountBudget <= 0 && remainingIncludedCredits <= 0) {
        state.budgetExhausted = true
        if (state.accountBlockedDate === null) {
          state.accountBlockedDate = record.date || null
        }
      }
      if (remainingProductBudget <= 0 && remainingIncludedCredits <= 0 && record.date && state.productBlockedDates[productBudgetName] === undefined) {
        state.productBlockedDates[productBudgetName] = record.date
      }
      return
    }

    const allowedGrossAmount = aicGrossAmount * allowedRatio
    const coveredQuantity = Math.min(allowedQuantity, remainingIncludedCredits)
    const additionalUsageQuantity = Math.max(allowedQuantity - coveredQuantity, 0)
    const additionalSpendAmount = additionalUsageQuantity * costPerAic

    state.totalBill += additionalSpendAmount
    if (additionalSpendAmount > 0 && record.date) {
      state.adjustedDailyNetCostByDate.set(record.date, (state.adjustedDailyNetCostByDate.get(record.date) ?? 0) + additionalSpendAmount)
    }
    if (accountBudgetLimited && allowedQuantity > remainingIncludedCredits && state.accountBlockedDate === null) {
      state.accountBlockedDate = record.date || null
      state.budgetExhausted = true
    }
    if (productBudgetLimited && allowedQuantity > remainingIncludedCredits && record.date && state.productBlockedDates[productBudgetName] === undefined) {
      state.productBlockedDates[productBudgetName] = record.date
    }
    if (state.remainingAccountBudget !== Number.POSITIVE_INFINITY) {
      const nextRemainingAccountBudget = Math.max(state.remainingAccountBudget - additionalSpendAmount, 0)
      if (
        nextRemainingAccountBudget <= 0
        && additionalSpendAmount > 0
        && remainingIncludedCredits <= 0
        && state.accountBlockedDate === null
      ) {
        state.accountBlockedDate = record.date || null
        state.budgetExhausted = true
      }
      state.remainingAccountBudget = nextRemainingAccountBudget
    }

    if (budgetSubject && remainingUserBudget !== Number.POSITIVE_INFINITY) {
      state.remainingUserBudgetByUser.set(budgetSubject, Math.max(remainingUserBudget - allowedGrossAmount, 0))
    }
    if (remainingProductBudget !== Number.POSITIVE_INFINITY) {
      const nextRemainingProductBudget = Math.max(remainingProductBudget - additionalSpendAmount, 0)
      if (
        nextRemainingProductBudget <= 0
        && additionalSpendAmount > 0
        && remainingIncludedCredits <= 0
        && record.date
        && state.productBlockedDates[productBudgetName] === undefined
      ) {
        state.productBlockedDates[productBudgetName] = record.date
      }
      state.remainingProductBudgetByName.set(productBudgetName, nextRemainingProductBudget)
    }

    state.remainingOrganizationIncludedCredits = setRemainingIncludedCredits(
      record,
      context,
      coveredQuantity,
      state.remainingMonthlyIncludedCredits,
      state.remainingOrganizationIncludedCredits,
    )
}

function finalizeBudgetSimulation(
  state: BudgetSimulationState,
  context: BudgetSimulationContext,
): BudgetSimulationResult {
  const blockedIncludedCreditsAic = context.reportPlanScope === 'organization'
    ? state.remainingOrganizationIncludedCredits
    : Array.from(state.seenIndividualIncludedCreditKeys).reduce(
      (total, key) => total + (state.remainingMonthlyIncludedCredits.get(key) ?? context.individualMonthlyIncludedCredits),
      0,
    )

  return {
    totalBill: state.totalBill,
    blockedUsers: state.blockedUsers.size,
    blockedRequests: Math.round(state.blockedRequests),
    blockedIncludedCreditsAic,
    budgetExhausted: state.budgetExhausted,
    firstUserBlockedDate: state.firstUserBlockedDate,
    accountBlockedDate: state.accountBlockedDate,
    productBlockedDates: state.productBlockedDates,
    adjustedDailyNetCostByDate: Array.from(state.adjustedDailyNetCostByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount })),
  }
}

export function simulateBudgetFromRecords(
  records: TokenUsageRecord[],
  options: BudgetSimulationOptions,
  context: BudgetSimulationContext,
): BudgetSimulationResult {
  const state = createBudgetSimulationState(options, context)

  for (const record of records) {
    simulateBudgetRecord(state, record, context)
  }

  return finalizeBudgetSimulation(state, context)
}

export async function runBudgetSimulation(
  file: File,
  options: BudgetSimulationOptions,
  includedCreditsOverrides: AicIncludedCreditsOverrides = {},
): Promise<BudgetSimulationResult> {
  const context = await calculateAicIncludedCreditsContext(file, includedCreditsOverrides)
  const state = createBudgetSimulationState(options, context)
  let header: TokenUsageHeader | null = null

  for await (const line of streamLines(file)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      continue
    }

    const record = parseNormalizedTokenUsageRecord(trimmed, header)
    if (!record) continue

    simulateBudgetRecord(state, record, context)
  }

  return finalizeBudgetSimulation(state, context)
}
