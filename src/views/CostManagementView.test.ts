import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { BudgetSimulationResult } from '../utils/budgetSimulation'
import { EMPTY_BUDGET_VALUES, type BudgetValues } from '../utils/costManagementBudgets'
import { CostManagementView } from './CostManagementView'

const baseBudgetValues: BudgetValues = {
  ...EMPTY_BUDGET_VALUES,
  account: '1',
}

const baseBudgetSimulation: BudgetSimulationResult = {
  totalBill: 0.4,
  blockedUsers: 1,
  blockedRequests: 7,
  blockedIncludedCreditsAic: 0,
  allowedAicQuantity: 40,
  budgetExhausted: true,
  firstUserBlockedDate: null,
  accountBlockedDate: '2026-06-01',
  productBlockedDates: {},
  adjustedDailyNetCostByDate: [],
  adjustedDailyGrossCostByDate: [],
}

function renderCostManagementView(overrides: Partial<Parameters<typeof CostManagementView>[0]> = {}): string {
  return renderToStaticMarkup(createElement(CostManagementView, {
    budgetValues: baseBudgetValues,
    isIndividualReport: false,
    currentPruBill: 0,
    currentPruGrossAmount: 0,
    currentPruDiscountAmount: 0,
    currentPruQuantity: 0,
    currentAicBill: 1,
    currentAicGrossAmount: 1,
    currentAicDiscountAmount: 0,
    currentAicQuantity: 100,
    includedAicPoolSize: 0,
    dailyUsageData: [],
    budgetSimulation: null,
    budgetSimulationError: null,
    isApplyingBudgetSimulation: false,
    onBudgetValueChange: vi.fn(),
    onApplyBudgetSimulation: vi.fn(),
    showOrganizationPromotionalDataDisclaimer: false,
    ...overrides,
  }))
}

describe('CostManagementView', () => {
  it('shows budget controls for native usage-based billing reports', () => {
    const html = renderCostManagementView({
      reportMode: 'native-ai-credits',
    })

    expect(html).toContain('Set USD budgets and preview how they would affect usage-based billing for this report.')
    expect(html).toContain('Account-level budget')
    expect(html).toContain('Apply')
    expect(html).not.toContain('Budget simulation is not available')
    expect(html).not.toContain('native AI Credits reports yet')
    expect(html).not.toContain('PRU')
  })

  it('uses AI Credits result labels instead of PRU labels for native reports', () => {
    const html = renderCostManagementView({
      reportMode: 'native-ai-credits',
      budgetSimulation: baseBudgetSimulation,
    })

    expect(html).toContain('Blocked AI Credits')
    expect(html).toContain('60')
    expect(html).toContain('Simulated AI Credits additional usage spend')
    expect(html).not.toContain('Blocked PRUs')
    expect(html).not.toContain('later requests')
  })

  it('keeps PRU blocked-usage labeling for transition-period reports', () => {
    const html = renderCostManagementView({
      reportMode: 'transition-period-billing-preview',
      budgetSimulation: baseBudgetSimulation,
    })

    expect(html).toContain('Blocked PRUs')
    expect(html).toContain('later requests')
    expect(html).not.toContain('Blocked AI Credits')
  })
})
