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
  total_input_tokens: number
  total_output_tokens: number
  total_cache_creation_tokens: number
  total_cache_read_tokens: number
}

export type TokenUsageHeader = {
  columns: string[]
  index: Record<string, number>
}

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

export function parseCsvRow(line: string): string[] {
  // Minimal RFC4180-ish parser for a single line: handles commas and double quotes.
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

function getInt(row: string[], i: number | undefined): number {
  const raw = getString(row, i).trim()
  if (!raw) return 0
  const n = Number.parseInt(raw, 10)
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

  // All fields are present in the example, but we stay resilient to missing/blank values.
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
    total_input_tokens: getInt(row, header.index['total_input_tokens']),
    total_output_tokens: getInt(row, header.index['total_output_tokens']),
    total_cache_creation_tokens: getInt(row, header.index['total_cache_creation_tokens']),
    total_cache_read_tokens: getInt(row, header.index['total_cache_read_tokens']),
  }
}
