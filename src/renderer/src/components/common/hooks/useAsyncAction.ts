import { useState } from 'react'
import { errorMessage } from '../../../utils/errorMessage'

// Wraps an async event handler with busy/error state and a re-entrancy guard, the shape several forms
// hand-rolled (setBusy(true) / try / catch / finally). Some copies skipped the catch, so a rejected
// action propagated as an unhandled rejection and its message never reached the user (config-form's
// reconfigure). `run` always returns to idle and records the failure as `error` instead of swallowing it.
export function useAsyncAction(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run, setError }
}
