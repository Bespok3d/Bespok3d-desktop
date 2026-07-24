// A thrown value is `unknown`: an Error carries the human message on `.message`, while bare
// `String(err)` prints "Error: ..." for an Error and "[object Object]" for a plain object. Collapse
// every catch site onto one reader so the surfaced text is the message, not the wrapper.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
