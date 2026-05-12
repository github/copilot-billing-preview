import { describe, expect, it } from 'vitest'
import {
  BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS,
  BUSINESS_MONTHLY_QUOTA,
  calculateAicIncludedCreditsPool,
  calculateLicenseSummary,
  ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
  ENTERPRISE_MONTHLY_QUOTA,
  getAicIncludedCreditTier,
  getIndividualPlanTier,
  getIndividualMonthlyAicIncludedCredits,
  getMonthlyAicIncludedCredits,
  getPlanLabel,
  IndividualAicIncludedCreditsAllocator,
  inferReportPlanScope,
  PRO_MONTHLY_AIC_INCLUDED_CREDITS,
  PRO_MONTHLY_QUOTA,
  PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS,
  PooledAicIncludedCreditsAllocator,
  PRO_PLUS_MONTHLY_QUOTA,
} from './aicIncludedCredits'
import { CostCenterAggregator } from './aggregators/costCenterAggregator'
import { OrganizationAggregator } from './aggregators/organizationAggregator'
import { UserUsageAggregator } from './aggregators/userUsageAggregator'
import { runPipeline } from './runPipeline'
import type { Aggregator } from './aggregators/base'
import type { TokenUsageHeader, TokenUsageRecord } from './parser'

const HEADER = [
  'date',
  'username',
  'product',
  'sku',
  'model',
  'quantity',
  'unit_type',
  'applied_cost_per_quantity',
  'gross_amount',
  'discount_amount',
  'net_amount',
  'exceeds_quota',
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
].join(',')

function createCsv(rows: string[][]): File {
  const body = [HEADER, ...rows.map((row) => row.join(','))].join('\n')
  return new File([body], 'usage.csv', { type: 'text/csv' })
}

function createRecord(overrides: Partial<TokenUsageRecord> = {}): TokenUsageRecord {
  return {
    date: '2026-03-01',
    username: 'mona',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    model: 'GPT-5',
    quantity: 10,
    unit_type: 'ai-credits',
    applied_cost_per_quantity: 0.01,
    gross_amount: 0.1,
    discount_amount: 0,
    net_amount: 0.1,
    exceeds_quota: false,
    total_monthly_quota: 300,
    organization: 'octo',
    cost_center_name: 'Cats',
    aic_quantity: 10,
    aic_gross_amount: 0.1,
    aic_net_amount: 0.1,
    has_aic_quantity: true,
    has_aic_gross_amount: true,
    ...overrides,
  }
}

class CaptureAggregator implements Aggregator<TokenUsageRecord, TokenUsageRecord[], TokenUsageHeader> {
  private readonly records: TokenUsageRecord[] = []

  onHeader(): void {
    // no-op
  }

  accumulate(record: TokenUsageRecord): void {
    this.records.push({ ...record })
  }

  result(): TokenUsageRecord[] {
    return this.records
  }
}

describe('AIC included credit tiering and pool sizing', () => {
  it('infers individual scope for a single-user report and organization scope otherwise', () => {
    expect(inferReportPlanScope(1)).toBe('individual')
    expect(inferReportPlanScope(0)).toBe('organization')
    expect(inferReportPlanScope(2)).toBe('organization')
  })

  it('infers organization scope for a single-user report with organization context', () => {
    expect(inferReportPlanScope(1, true)).toBe('organization')
  })

  it('classifies 299 as null', () => {
    expect(getAicIncludedCreditTier(299)).toBeNull()
  })

  it('classifies 300 as business', () => {
    expect(getAicIncludedCreditTier(BUSINESS_MONTHLY_QUOTA)).toBe('business')
  })

  it('classifies 999 as null', () => {
    expect(getAicIncludedCreditTier(999)).toBeNull()
  })

  it('classifies 1000 as enterprise', () => {
    expect(getAicIncludedCreditTier(ENTERPRISE_MONTHLY_QUOTA)).toBe('enterprise')
  })

  it('does not classify individual quotas as company included credit tiers', () => {
    expect(getAicIncludedCreditTier(BUSINESS_MONTHLY_QUOTA, 'individual')).toBeNull()
    expect(getAicIncludedCreditTier(ENTERPRISE_MONTHLY_QUOTA, 'individual')).toBeNull()
  })

  it('classifies 300 as Pro/Student for an individual report', () => {
    expect(getIndividualPlanTier(PRO_MONTHLY_QUOTA)).toBe('pro-student')
  })

  it('classifies 1500 as Pro+ for an individual report', () => {
    expect(getIndividualPlanTier(PRO_PLUS_MONTHLY_QUOTA)).toBe('pro-plus')
  })

  it('returns 0 included credits for 299', () => {
    expect(getMonthlyAicIncludedCredits(299)).toBe(0)
  })

  it('returns 3000 included credits for 300', () => {
    expect(getMonthlyAicIncludedCredits(BUSINESS_MONTHLY_QUOTA)).toBe(BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS)
  })

  it('returns 7000 included credits for 1000', () => {
    expect(getMonthlyAicIncludedCredits(ENTERPRISE_MONTHLY_QUOTA)).toBe(ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS)
  })

  it('does not apply organization pooled credits in individual scope', () => {
    expect(getMonthlyAicIncludedCredits(PRO_MONTHLY_QUOTA, 'individual')).toBe(0)
    expect(getMonthlyAicIncludedCredits(PRO_PLUS_MONTHLY_QUOTA, 'individual')).toBe(0)
  })

  it('returns monthly included credits for individual plans', () => {
    expect(getIndividualMonthlyAicIncludedCredits(PRO_MONTHLY_QUOTA)).toBe(PRO_MONTHLY_AIC_INCLUDED_CREDITS)
    expect(getIndividualMonthlyAicIncludedCredits(PRO_PLUS_MONTHLY_QUOTA)).toBe(PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS)
  })

  it('formats plan labels for known quotas', () => {
    expect(getPlanLabel(BUSINESS_MONTHLY_QUOTA)).toBe('Copilot Business')
    expect(getPlanLabel(ENTERPRISE_MONTHLY_QUOTA)).toBe('Copilot Enterprise')
  })

  it('formats plan labels for known individual quotas', () => {
    expect(getPlanLabel(PRO_MONTHLY_QUOTA, 'individual')).toBe('Copilot Pro/Student')
    expect(getPlanLabel(PRO_PLUS_MONTHLY_QUOTA, 'individual')).toBe('Copilot Pro+')
  })

  it('formats plan labels for unknown quotas', () => {
    expect(getPlanLabel(999)).toBe('Unknown (999 PRUs/month)')
    expect(getPlanLabel(0)).toBe('Unknown')
  })

  it('does not create an organization pool for a single-user Pro/Student report', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', '', '', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(0)
  })

  it('creates a business pool for a single-user report with organization metadata', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'example-org', 'Cost Center A', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS)
  })

  it('does not create an organization pool for a single-user Enterprise-quota individual report', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', '', '', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(0)
  })

  it('does not create an organization pool for a single-user Pro+ report', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1500', '', '', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(0)
  })

  it('sums business and enterprise users in the same pool', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-01', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS + ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('uses override seat counts instead of active users when sizing an organization pool', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'example-org', 'Cost Center A', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file, { business: 2, enterprise: 1 })).resolves.toBe(
      (2 * BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS) + ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('uses the maximum quota seen for the same user before applying individual-plan classification', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1500', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(0)
  })

  it('trims usernames before contributing to the pool', async () => {
    const file = createCsv([
      ['2026-03-01', ' mona ', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(
      ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS + BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('treats case-distinct usernames as separate users', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'MONA', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS + ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('ignores empty usernames when sizing the pool', async () => {
    const file = createCsv([
      ['2026-03-01', '', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS + ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('groups users into Copilot Business and Copilot Enterprise license summary rows', () => {
    const summary = calculateLicenseSummary([
      { totalMonthlyQuota: 300 },
      { totalMonthlyQuota: 300 },
      { totalMonthlyQuota: 1000 },
      { totalMonthlyQuota: 999 },
    ])

    expect(summary).toEqual({
      rows: [
        { label: 'Copilot Business', users: 2, includedAic: 6000 },
        { label: 'Copilot Enterprise', users: 1, includedAic: 7000 },
      ],
      totalUsers: 3,
      totalIncludedAic: 13000,
    })
  })

  it('summarizes a single-user report as an individual plan', () => {
    const summary = calculateLicenseSummary([{ totalMonthlyQuota: 1500 }])

    expect(summary).toEqual({
      rows: [
        { label: 'Copilot Pro+', users: 1, includedAic: 7000 },
      ],
      totalUsers: 1,
      totalIncludedAic: 7000,
    })
  })

  it('summarizes a single-user report with organization metadata as a business plan', () => {
    const summary = calculateLicenseSummary([
      { totalMonthlyQuota: 300, organizations: ['example-org'], costCenters: ['Cost Center A'] },
    ])

    expect(summary).toEqual({
      rows: [
        { label: 'Copilot Business', users: 1, includedAic: 3000 },
        { label: 'Copilot Enterprise', users: 0, includedAic: 0 },
      ],
      totalUsers: 1,
      totalIncludedAic: 3000,
    })
  })

  it('counts a single-organization user only once across multiple rows in the same cost center when sizing the pool', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '1500', 'ai-credits', '0.01', '15.00', '0', '15.00', 'False', '300', 'example-org', 'Cost Center A', '1500', '15.00'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '1600', 'ai-credits', '0.01', '16.00', '0', '16.00', 'False', '300', 'example-org', 'Cost Center A', '1600', '16.00'],
      ['2026-03-03', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '7000', 'ai-credits', '0.01', '70.00', '0', '70.00', 'False', '1000', 'example-org', 'Cost Center A', '7000', '70.00'],
    ])

    await expect(calculateAicIncludedCreditsPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS + ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS,
    )
  })

  it('keeps one-organization mixed Teams billing aligned across users, license summary, organizations, and cost centers', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '2000', 'ai-credits', '0.01', '20.00', '0', '20.00', 'False', '300', 'example-org', 'Cost Center A', '2000', '20.00'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '1500', 'ai-credits', '0.01', '15.00', '0', '15.00', 'False', '300', 'example-org', 'Cost Center A', '1500', '15.00'],
      ['2026-03-03', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '7000', 'ai-credits', '0.01', '70.00', '0', '70.00', 'False', '1000', 'example-org', 'Cost Center A', '7000', '70.00'],
      ['2026-03-04', 'octocat', 'copilot', 'copilot_ai_credit', 'GPT-5', '3500', 'ai-credits', '0.01', '35.00', '0', '35.00', 'False', '300', 'example-org', 'Cost Center B', '3500', '35.00'],
    ])
    const users = new UserUsageAggregator()
    const organizations = new OrganizationAggregator()
    const costCenters = new CostCenterAggregator()

    await runPipeline(file, [users, organizations, costCenters])

    const userResult = users.result().users
    const organizationResult = organizations.result().organizations
    const costCenterResult = costCenters.result().costCenters
    const licenseSummary = calculateLicenseSummary(userResult)

    expect(licenseSummary).toEqual({
      rows: [
        { label: 'Copilot Business', users: 2, includedAic: 6000 },
        { label: 'Copilot Enterprise', users: 1, includedAic: 7000 },
      ],
      totalUsers: 3,
      totalIncludedAic: 13000,
    })

    expect(userResult.map((user) => user.username)).toEqual(['hubot', 'mona', 'octocat'])
    expect(userResult.find((user) => user.username === 'mona')).toEqual(expect.objectContaining({
      totalMonthlyQuota: 300,
      organizations: ['example-org'],
      costCenters: ['Cost Center A'],
      totals: expect.objectContaining({
        aicQuantity: 3500,
        aicGrossAmount: 35,
        aicNetAmount: 0,
      }),
    }))
    expect(userResult.find((user) => user.username === 'octocat')).toEqual(expect.objectContaining({
      totalMonthlyQuota: 300,
      organizations: ['example-org'],
      costCenters: ['Cost Center B'],
      totals: expect.objectContaining({
        aicQuantity: 3500,
        aicGrossAmount: 35,
        aicNetAmount: 10,
      }),
    }))

    expect(organizationResult).toEqual([
      expect.objectContaining({
        organization: 'example-org',
        userCount: 3,
        totals: expect.objectContaining({
          aicQuantity: 14000,
          aicGrossAmount: 140,
          aicNetAmount: 10,
        }),
      }),
    ])

    expect(costCenterResult).toEqual([
      expect.objectContaining({
        costCenterName: 'Cost Center A',
        userCount: 2,
        totals: expect.objectContaining({
          aicQuantity: 10500,
          aicGrossAmount: 105,
          aicNetAmount: 0,
        }),
      }),
      expect.objectContaining({
        costCenterName: 'Cost Center B',
        userCount: 1,
        totals: expect.objectContaining({
          aicQuantity: 3500,
          aicGrossAmount: 35,
          aicNetAmount: 10,
        }),
      }),
    ])
  })
})

describe('pooled AIC allocation and derived AIC discounts', () => {
  it('sets aic_net_amount to 0 when the row is fully covered', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(10)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0)
  })

  it('leaves aic_net_amount equal to AIC gross when the pool is 0', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(0)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0.1)
  })

  it('applies the uncovered ratio for partial coverage', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(4)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.2, aic_net_amount: 0.2 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBeCloseTo(0.12)
  })

  it('decreases the remaining balance by covered AIC quantity only', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(4)

    allocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.2, aic_net_amount: 0.2 }))

    expect(allocator.remaining()).toBe(0)
  })

  it('leaves aic_net_amount unchanged when aicQuantity is 0 or less', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(10)
    const record = createRecord({ aic_quantity: 0, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0.1)
    expect(allocator.remaining()).toBe(10)
  })

  it('leaves aic_net_amount unchanged when aicGrossAmount is 0 or less', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(10)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0, aic_net_amount: 0 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0)
    expect(allocator.remaining()).toBe(10)
  })

  it('exhausts the pool across multiple rows', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(10)
    const first = allocator.apply(createRecord({ aic_quantity: 6, aic_gross_amount: 0.06, aic_net_amount: 0.06 }))
    const second = allocator.apply(createRecord({ aic_quantity: 6, aic_gross_amount: 0.06, aic_net_amount: 0.06 }))

    expect(first.aic_net_amount).toBe(0)
    expect(second.aic_net_amount).toBeCloseTo(0.02)
    expect(allocator.remaining()).toBe(0)
  })

  it('produces different per-row net amounts when row order changes', () => {
    const firstAllocator = new PooledAicIncludedCreditsAllocator(10)
    const firstSmall = firstAllocator.apply(createRecord({ aic_quantity: 4, aic_gross_amount: 0.04, aic_net_amount: 0.04 }))
    const firstLarge = firstAllocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 }))

    const secondAllocator = new PooledAicIncludedCreditsAllocator(10)
    const secondLarge = secondAllocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 }))
    const secondSmall = secondAllocator.apply(createRecord({ aic_quantity: 4, aic_gross_amount: 0.04, aic_net_amount: 0.04 }))

    expect(firstSmall.aic_net_amount).toBe(0)
    expect(firstLarge.aic_net_amount).toBeCloseTo(0.04)
    expect(secondLarge.aic_net_amount).toBe(0)
    expect(secondSmall.aic_net_amount).toBe(0.04)
  })

  it('preserves reasonable floating-point accuracy for fractional values', () => {
    const allocator = new PooledAicIncludedCreditsAllocator(0.3)
    const record = createRecord({ aic_quantity: 0.5, aic_gross_amount: 0.05, aic_net_amount: 0.05 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBeCloseTo(0.02)
  })

  it('applies pooled allocation before records reach aggregators in runPipeline', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '10', 'ai-credits', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '7000', 'ai-credits', '0.01', '70.00', '0', '70.00', 'False', '300', 'octo', 'Cats', '7000', '70.00'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator])

    const records = aggregator.result()
    expect(records).toHaveLength(2)
    expect(records[0].aic_net_amount).toBe(0)
    expect(records[1].aic_net_amount).toBeCloseTo(10.1)
  })

  it('reapplies pooled allocation with override seat counts before records reach aggregators in runPipeline', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '3500', 'ai-credits', '0.01', '35.00', '0', '35.00', 'False', '300', 'octo', 'Cats', '3500', '35.00'],
      ['2026-03-02', 'hubot', 'copilot', 'copilot_ai_credit', 'GPT-5', '3500', 'ai-credits', '0.01', '35.00', '0', '35.00', 'False', '300', 'octo', 'Cats', '3500', '35.00'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator], { includedCreditsOverrides: { business: 2 } })

    const records = aggregator.result()
    expect(records).toHaveLength(2)
    expect(records[0].aic_net_amount).toBe(0)
    expect(records[1].aic_net_amount).toBeCloseTo(10)
  })
})

describe('individual monthly AIC allocation', () => {
  it('covers usage up to the monthly Pro included credit before charging additional spend', () => {
    const allocator = new IndividualAicIncludedCreditsAllocator(PRO_MONTHLY_AIC_INCLUDED_CREDITS)
    const first = allocator.apply(createRecord({
      date: '2026-03-02',
      aic_quantity: 700,
      aic_gross_amount: 7,
      aic_net_amount: 7,
    }))
    const second = allocator.apply(createRecord({
      date: '2026-03-04',
      aic_quantity: 700,
      aic_gross_amount: 7,
      aic_net_amount: 7,
    }))

    expect(first.aic_net_amount).toBe(0)
    expect(second.aic_net_amount).toBe(0)
    expect(allocator.remainingFor('mona', '2026-03-04')).toBe(100)
  })

  it('resets the included credit at the start of a new month', () => {
    const allocator = new IndividualAicIncludedCreditsAllocator(PRO_MONTHLY_AIC_INCLUDED_CREDITS)

    allocator.apply(createRecord({
      date: '2026-03-02',
      aic_quantity: 1000,
      aic_gross_amount: 10,
      aic_net_amount: 10,
    }))
    const nextMonth = allocator.apply(createRecord({
      date: '2026-04-01',
      aic_quantity: 1000,
      aic_gross_amount: 10,
      aic_net_amount: 10,
    }))

    expect(nextMonth.aic_net_amount).toBe(0)
    expect(allocator.remainingFor('mona', '2026-04-01')).toBe(500)
  })

  it('does not carry unused individual included credits into the next month', () => {
    const allocator = new IndividualAicIncludedCreditsAllocator(PRO_MONTHLY_AIC_INCLUDED_CREDITS)

    allocator.apply(createRecord({
      date: '2026-03-02',
      aic_quantity: 600,
      aic_gross_amount: 6,
      aic_net_amount: 6,
    }))
    const nextMonth = allocator.apply(createRecord({
      date: '2026-04-01',
      aic_quantity: 1200,
      aic_gross_amount: 12,
      aic_net_amount: 12,
    }))

    expect(nextMonth.aic_net_amount).toBe(0)
    expect(allocator.remainingFor('mona', '2026-04-01')).toBe(300)
  })

  it('applies the larger monthly included credit for Pro+ users', () => {
    const allocator = new IndividualAicIncludedCreditsAllocator(PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS)
    const record = allocator.apply(createRecord({
      date: '2026-03-02',
      total_monthly_quota: 1500,
      aic_quantity: 4000,
      aic_gross_amount: 40,
      aic_net_amount: 40,
    }))

    expect(record.aic_net_amount).toBe(0)
    expect(allocator.remainingFor('mona', '2026-03-02')).toBe(3000)
  })

  it('applies monthly individual allocation before records reach aggregators in runPipeline', async () => {
    const file = createCsv([
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '700', 'ai-credits', '0.01', '7.00', '0', '7.00', 'False', '300', '', '', '700', '7.00'],
      ['2026-03-04', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '700', 'ai-credits', '0.01', '7.00', '0', '7.00', 'False', '300', '', '', '700', '7.00'],
      ['2026-04-01', 'mona', 'copilot', 'copilot_ai_credit', 'GPT-5', '700', 'ai-credits', '0.01', '7.00', '0', '7.00', 'False', '300', '', '', '700', '7.00'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator])

    const records = aggregator.result()
    expect(records).toHaveLength(3)
    expect(records[0].aic_net_amount).toBe(0)
    expect(records[1].aic_net_amount).toBe(0)
    expect(records[2].aic_net_amount).toBe(0)
  })
})
