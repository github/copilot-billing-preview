export interface Aggregator<TRow, TResult, THeader = unknown> {
  onHeader?(header: THeader): void
  accumulate(record: TRow, index: number): void
  result(): TResult
}
