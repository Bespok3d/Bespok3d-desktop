// The OS arp table is printed differently per platform (macOS "arp -an", Linux
// /proc/net/arp, Windows "arp -a"). Rather than three parsers, scan each line for
// an IPv4 address and a MAC token, which covers all three layouts.

const IPV4 = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/
const MAC = /\b([0-9a-fA-F]{1,2}(?:[:-][0-9a-fA-F]{1,2}){5})\b/

export function normalizeMac(raw: string): string {
  return raw
    .split(/[:-]/)
    .map((octet) => octet.toLowerCase().padStart(2, '0'))
    .join(':')
}

export function parseArpTable(text: string): Map<string, string> {
  const table = new Map<string, string>()
  text.split('\n').forEach((line) => addArpRow(table, line))

  return table
}

function addArpRow(table: Map<string, string>, line: string): void {
  const ipMatch = line.match(IPV4)
  const macMatch = line.match(MAC)
  if (ipMatch && macMatch) table.set(ipMatch[1], normalizeMac(macMatch[1]))
}
