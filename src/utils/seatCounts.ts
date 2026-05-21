export function normalizeSeatCount(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.max(minimum, Math.floor(value))
}

export function parseSeatCountInput(raw: string, minimum: number): number {
  const trimmed = raw.trim()
  if (trimmed === '') return minimum

  return normalizeSeatCount(Number(trimmed), minimum)
}

export function getSeatReductionError(value: string, minimum: number): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Math.floor(parsed) >= minimum) return null

  return `Cannot go below ${minimum.toLocaleString()} because that count comes from historical report data.`
}
