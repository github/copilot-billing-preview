export function normalizeSeatCount(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }

  return Math.max(minimum, Math.floor(value))
}

export function parseSeatCountInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed)) return null

  return parsed
}

export function getSeatCountInputError(value: string, minimum: number): string | null {
  const parsed = parseSeatCountInput(value)
  if (parsed === null) {
    return `Enter a whole number greater than or equal to ${minimum.toLocaleString()} because that count comes from historical report data.`
  }

  if (parsed >= minimum) return null

  return `Cannot go below ${minimum.toLocaleString()} because that count comes from historical report data.`
}
