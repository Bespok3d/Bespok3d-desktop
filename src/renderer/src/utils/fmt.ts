export function fmtCount(ct: number): string {
  if (ct >= 1000) return (ct / 1000).toFixed(ct >= 10000 ? 0 : 1) + 'k'

  return String(ct)
}
