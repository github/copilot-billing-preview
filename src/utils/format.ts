export function formatUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatAic(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

export function formatDifference(diff: number): string {
  if (diff === 0) return formatUsd(0)
  return `${diff > 0 ? '−' : '+'}${formatUsd(Math.abs(diff))}`
}
