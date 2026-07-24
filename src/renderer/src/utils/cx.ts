function cx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ')
}

export default cx
