import { describe, expect, it } from 'vitest'
import {
  BUSINESS_MONTHLY_AIC_ENTITLEMENTS,
  BUSINESS_MONTHLY_QUOTA,
  calculateAicEntitlementPool,
  calculateLicenseSummary,
  ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS,
  ENTERPRISE_MONTHLY_QUOTA,
  getAicEntitlementTier,
  getMonthlyAicEntitlements,
  PooledAicEntitlementAllocator,
} from './aicEntitlements'
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
    sku: 'copilot_ai_unit',
    model: 'GPT-5',
    quantity: 10,
    unit_type: 'ai-units',
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

describe('AIC entitlement tiering and pool sizing', () => {
  it('classifies 299 as null', () => {
    expect(getAicEntitlementTier(299)).toBeNull()
  })

  it('classifies 300 as business', () => {
    expect(getAicEntitlementTier(BUSINESS_MONTHLY_QUOTA)).toBe('business')
  })

  it('classifies 999 as null', () => {
    expect(getAicEntitlementTier(999)).toBeNull()
  })

  it('classifies 1000 as enterprise', () => {
    expect(getAicEntitlementTier(ENTERPRISE_MONTHLY_QUOTA)).toBe('enterprise')
  })

  it('returns 0 entitlements for 299', () => {
    expect(getMonthlyAicEntitlements(299)).toBe(0)
  })

  it('returns 3000 entitlements for 300', () => {
    expect(getMonthlyAicEntitlements(BUSINESS_MONTHLY_QUOTA)).toBe(BUSINESS_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('returns 7000 entitlements for 1000', () => {
    expect(getMonthlyAicEntitlements(ENTERPRISE_MONTHLY_QUOTA)).toBe(ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('sizes the pool for one business user', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(BUSINESS_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('sizes the pool for one enterprise user', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('sums business and enterprise users in the same pool', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-01', 'hubot', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_ENTITLEMENTS + ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS,
    )
  })

  it('uses the maximum quota seen for the same user', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('trims usernames before contributing to the pool', async () => {
    const file = createCsv([
      ['2026-03-01', ' mona ', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS)
  })

  it('treats case-distinct usernames as separate users', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'MONA', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(
      BUSINESS_MONTHLY_AIC_ENTITLEMENTS + ENTERPRISE_MONTHLY_AIC_ENTITLEMENTS,
    )
  })

  it('ignores empty usernames when sizing the pool', async () => {
    const file = createCsv([
      ['2026-03-01', '', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '1000', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
    ])

    await expect(calculateAicEntitlementPool(file)).resolves.toBe(BUSINESS_MONTHLY_AIC_ENTITLEMENTS)
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
})

describe('pooled AIC allocation and derived AIC discounts', () => {
  it('sets aic_net_amount to 0 when the row is fully covered', () => {
    const allocator = new PooledAicEntitlementAllocator(10)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0)
  })

  it('leaves aic_net_amount equal to AIC gross when the pool is 0', () => {
    const allocator = new PooledAicEntitlementAllocator(0)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0.1)
  })

  it('applies the uncovered ratio for partial coverage', () => {
    const allocator = new PooledAicEntitlementAllocator(4)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0.2, aic_net_amount: 0.2 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBeCloseTo(0.12)
  })

  it('decreases the remaining balance by covered AIC quantity only', () => {
    const allocator = new PooledAicEntitlementAllocator(4)

    allocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.2, aic_net_amount: 0.2 }))

    expect(allocator.remaining()).toBe(0)
  })

  it('leaves aic_net_amount unchanged when aicQuantity is 0 or less', () => {
    const allocator = new PooledAicEntitlementAllocator(10)
    const record = createRecord({ aic_quantity: 0, aic_gross_amount: 0.1, aic_net_amount: 0.1 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0.1)
    expect(allocator.remaining()).toBe(10)
  })

  it('leaves aic_net_amount unchanged when aicGrossAmount is 0 or less', () => {
    const allocator = new PooledAicEntitlementAllocator(10)
    const record = createRecord({ aic_quantity: 10, aic_gross_amount: 0, aic_net_amount: 0 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBe(0)
    expect(allocator.remaining()).toBe(10)
  })

  it('exhausts the pool across multiple rows', () => {
    const allocator = new PooledAicEntitlementAllocator(10)
    const first = allocator.apply(createRecord({ aic_quantity: 6, aic_gross_amount: 0.06, aic_net_amount: 0.06 }))
    const second = allocator.apply(createRecord({ aic_quantity: 6, aic_gross_amount: 0.06, aic_net_amount: 0.06 }))

    expect(first.aic_net_amount).toBe(0)
    expect(second.aic_net_amount).toBeCloseTo(0.02)
    expect(allocator.remaining()).toBe(0)
  })

  it('produces different per-row net amounts when row order changes', () => {
    const firstAllocator = new PooledAicEntitlementAllocator(10)
    const firstSmall = firstAllocator.apply(createRecord({ aic_quantity: 4, aic_gross_amount: 0.04, aic_net_amount: 0.04 }))
    const firstLarge = firstAllocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 }))

    const secondAllocator = new PooledAicEntitlementAllocator(10)
    const secondLarge = secondAllocator.apply(createRecord({ aic_quantity: 10, aic_gross_amount: 0.1, aic_net_amount: 0.1 }))
    const secondSmall = secondAllocator.apply(createRecord({ aic_quantity: 4, aic_gross_amount: 0.04, aic_net_amount: 0.04 }))

    expect(firstSmall.aic_net_amount).toBe(0)
    expect(firstLarge.aic_net_amount).toBeCloseTo(0.04)
    expect(secondLarge.aic_net_amount).toBe(0)
    expect(secondSmall.aic_net_amount).toBe(0.04)
  })

  it('preserves reasonable floating-point accuracy for fractional values', () => {
    const allocator = new PooledAicEntitlementAllocator(0.3)
    const record = createRecord({ aic_quantity: 0.5, aic_gross_amount: 0.05, aic_net_amount: 0.05 })

    const allocated = allocator.apply(record)

    expect(allocated.aic_net_amount).toBeCloseTo(0.02)
  })

  it('applies pooled allocation before records reach aggregators in runPipeline', async () => {
    const file = createCsv([
      ['2026-03-01', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '10', 'ai-units', '0.01', '0.10', '0', '0.10', 'False', '300', 'octo', 'Cats', '10', '0.10'],
      ['2026-03-02', 'mona', 'copilot', 'copilot_ai_unit', 'GPT-5', '3005', 'ai-units', '0.01', '30.05', '0', '30.05', 'False', '300', 'octo', 'Cats', '3005', '30.05'],
    ])
    const aggregator = new CaptureAggregator()

    await runPipeline(file, [aggregator])

    const records = aggregator.result()
    expect(records).toHaveLength(2)
    expect(records[0].aic_net_amount).toBe(0)
    expect(records[1].aic_net_amount).toBeCloseTo(0.15)
  })
})
