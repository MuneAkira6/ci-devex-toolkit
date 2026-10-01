// The one rule the generated modules follow. The harness computes the same sum on the host and
// compares it with what the server answers, so `first-request` checks a value and not just a 200.
export function weightOf(index: number): number {
  return (index * 7919) % 10007
}
