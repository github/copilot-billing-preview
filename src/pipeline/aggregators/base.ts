export interface Aggregator<TParsed, TResult> {
  onHeader?(header: TParsed): void
  accumulate(record: TParsed, index: number): void
  result(): TResult
}
