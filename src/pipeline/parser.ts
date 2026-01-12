export type ParsedRow = string[]

export function parseCsvLine(line: string): ParsedRow {
  // Simple CSV split; adequate for counting rows and can be replaced with a richer parser later.
  return line.replace(/\r$/, '').split(',')
}
