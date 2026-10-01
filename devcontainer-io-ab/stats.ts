/**
 * The four numbers the results table is made of. They are in their own module so that they can be
 * tested on planted values: a median that is only ever computed by the thing that prints it has
 * never been checked.
 */

export type Summary = {
  readonly median: number
  readonly min: number
  readonly max: number
  readonly count: number
}

/**
 * The middle value, or the mean of the two middle values when the count is even. Rounded to one
 * decimal so that an even count does not print a false precision of milliseconds.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median of no values')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] as number
  return Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) * 5) / 10
}

export function summarise(values: readonly number[]): Summary {
  if (values.length === 0) throw new Error('summary of no values')
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  }
}

/** bind ÷ volume, to two decimals. Above 1 means the bind arm took longer. */
export function ratio(bind: number, volume: number): number {
  if (volume === 0) throw new Error('ratio with a zero denominator')
  return Math.round((bind / volume) * 100) / 100
}
