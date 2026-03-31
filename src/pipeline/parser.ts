export const KNOWN_PRODUCTS = ['copilot', 'spark'] as const
export const KNOWN_SKUS = [
  'copilot_premium_request',
  'coding_agent_premium_request',
  'copilot_ai_unit',
  'coding_agent_ai_unit',
  'spark_ai_unit',
] as const
export const KNOWN_UNIT_TYPES = ['requests', 'ai-units'] as const

export type TokenUsageRecord = {
  date: string
  username: string
  product: string
  sku: string
  model: string
  quantity: number
  unit_type: string
  applied_cost_per_quantity: number
  gross_amount: number
  discount_amount: number
  net_amount: number
  exceeds_quota: boolean
  total_monthly_quota: number
  organization: string
  cost_center_name: string | null
  aic_quantity: number
  aic_gross_amount: number
  aic_net_amount: number
  has_aic_quantity: boolean
  has_aic_gross_amount: boolean
}

export type TokenUsageHeader = {
  columns: string[]
  index: Record<string, number>
}

export function isRequestUsageRecord(unitType: string): boolean {
  return unitType === 'requests'
}

export function isAiUnitUsageRecord(unitType: string): boolean {
  return unitType === 'ai-units'
}

export type UsageMetrics = {
  requests: number
  aiuQuantity: number
  grossAmount: number
  aiuGrossAmount: number
  aicNetAmount: number
  discountAmount: number
  netAmount: number
}

export function getAicUsageMetrics(record: TokenUsageRecord): Pick<UsageMetrics, 'aiuQuantity' | 'aiuGrossAmount'> {
  if (isAiUnitUsageRecord(record.unit_type)) {
    return {
      aiuQuantity: record.has_aic_quantity ? record.aic_quantity : record.quantity,
      aiuGrossAmount: record.has_aic_gross_amount ? record.aic_gross_amount : record.gross_amount,
    }
  }

  return {
    aiuQuantity: record.aic_quantity,
    aiuGrossAmount: record.aic_gross_amount,
  }
}

export function getUsageMetrics(record: TokenUsageRecord): UsageMetrics {
  const quantity = record.quantity
  const grossAmount = record.gross_amount
  const discountAmount = record.discount_amount
  const netAmount = record.net_amount
  const { aiuQuantity, aiuGrossAmount } = getAicUsageMetrics(record)

  if (isAiUnitUsageRecord(record.unit_type)) {
    return {
      requests: 0,
      aiuQuantity,
      grossAmount: 0,
      aiuGrossAmount,
      aicNetAmount: record.aic_net_amount,
      discountAmount: 0,
      netAmount: 0,
    }
  }

  return {
    requests: quantity,
    aiuQuantity,
    grossAmount,
    aiuGrossAmount,
    aicNetAmount: record.aic_net_amount,
    discountAmount,
    netAmount,
  }
}

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

export function parseCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1]
        if (next === '"') {
          cur += '"'
          i += 1
          continue
        }
        inQuotes = false
        continue
      }
      cur += ch
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      out.push(cur)
      cur = ''
      continue
    }

    cur += ch
  }

  out.push(cur)
  return out
}

export function parseTokenUsageHeader(line: string): TokenUsageHeader {
  const columns = parseCsvRow(line).map((c, idx) => (idx === 0 ? stripBom(c) : c).trim())
  const index: Record<string, number> = {}
  columns.forEach((c, i) => {
    index[c] = i
  })
  return { columns, index }
}

function getString(row: string[], i: number | undefined): string {
  return i === undefined ? '' : (row[i] ?? '')
}

function getNumber(row: string[], i: number | undefined): number {
  const raw = getString(row, i).trim()
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function getBool(row: string[], i: number | undefined): boolean {
  const raw = getString(row, i).trim().toLowerCase()
  return raw === 'true'
}

function getNullableString(row: string[], i: number | undefined): string | null {
  const raw = getString(row, i).trim()
  return raw ? raw : null
}

function getOptionalHeaderIndex(header: TokenUsageHeader, ...names: string[]): number | undefined {
  return names.map((name) => header.index[name]).find((index) => index !== undefined)
}

export function parseTokenUsageRecord(line: string, header: TokenUsageHeader): TokenUsageRecord {
  const row = parseCsvRow(line)
  const aicQuantityIndex = getOptionalHeaderIndex(header, 'aic_quantity', 'aiu_quantity')
  const aicGrossAmountIndex = getOptionalHeaderIndex(header, 'aic_gross_amount', 'aiu_gross_amount')
  const aicQuantityRaw = getString(row, aicQuantityIndex).trim()
  const aicGrossAmountRaw = getString(row, aicGrossAmountIndex).trim()

  const record: TokenUsageRecord = {
    date: getString(row, header.index['date']).trim(),
    username: getString(row, header.index['username']).trim(),
    product: getString(row, header.index['product']).trim(),
    sku: getString(row, header.index['sku']).trim(),
    model: getString(row, header.index['model']).trim(),
    quantity: getNumber(row, header.index['quantity']),
    unit_type: getString(row, header.index['unit_type']).trim(),
    applied_cost_per_quantity: getNumber(row, header.index['applied_cost_per_quantity']),
    gross_amount: getNumber(row, header.index['gross_amount']),
    discount_amount: getNumber(row, header.index['discount_amount']),
    net_amount: getNumber(row, header.index['net_amount']),
    exceeds_quota: getBool(row, header.index['exceeds_quota']),
    total_monthly_quota: getNumber(row, header.index['total_monthly_quota']),
    organization: getString(row, header.index['organization']).trim(),
    cost_center_name: getNullableString(row, header.index['cost_center_name']),
    aic_quantity: getNumber(row, aicQuantityIndex),
    aic_gross_amount: getNumber(row, aicGrossAmountIndex),
    aic_net_amount: 0,
    has_aic_quantity: aicQuantityRaw !== '',
    has_aic_gross_amount: aicGrossAmountRaw !== '',
  }

  record.aic_net_amount = getAicUsageMetrics(record).aiuGrossAmount
  return record
}
