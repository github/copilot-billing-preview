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
  aiu_quantity: number
  aiu_gross_amount: number
  has_aiu_quantity: boolean
  has_aiu_gross_amount: boolean
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
  discountAmount: number
  netAmount: number
}

export function getUsageMetrics(record: TokenUsageRecord): UsageMetrics {
  const quantity = record.quantity
  const grossAmount = record.gross_amount
  const discountAmount = record.discount_amount
  const netAmount = record.net_amount

  if (isAiUnitUsageRecord(record.unit_type)) {
    const aiuQuantity = record.has_aiu_quantity ? record.aiu_quantity : quantity
    const aiuGrossAmount = record.has_aiu_gross_amount ? record.aiu_gross_amount : grossAmount

    return {
      requests: 0,
      aiuQuantity,
      grossAmount: 0,
      aiuGrossAmount,
      discountAmount: 0,
      netAmount: 0,
    }
  }

  return {
    requests: quantity,
    aiuQuantity: record.aiu_quantity,
    grossAmount,
    aiuGrossAmount: record.aiu_gross_amount,
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

export function parseTokenUsageRecord(line: string, header: TokenUsageHeader): TokenUsageRecord {
  const row = parseCsvRow(line)
  const aiuQuantityRaw = getString(row, header.index['aiu_quantity']).trim()
  const aiuGrossAmountRaw = getString(row, header.index['aiu_gross_amount']).trim()

  return {
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
    aiu_quantity: getNumber(row, header.index['aiu_quantity']),
    aiu_gross_amount: getNumber(row, header.index['aiu_gross_amount']),
    has_aiu_quantity: aiuQuantityRaw !== '',
    has_aiu_gross_amount: aiuGrossAmountRaw !== '',
  }
}
