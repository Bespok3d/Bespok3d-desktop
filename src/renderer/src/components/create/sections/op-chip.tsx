export function OpChip({ op, subtle }: { op: string; subtle?: boolean }) {
  return <span className={subtle ? 'op-chip subtle' : 'op-chip'}>{op}</span>
}
