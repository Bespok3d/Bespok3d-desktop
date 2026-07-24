import { useEffect, type DependencyList } from 'react'

type StaleCheck = () => boolean

// Runs an async effect whose result must be ignored once the component unmounts (or the deps change)
// before it settles, so a late resolve never sets state on a dead tree (or shows a stale printer's
// data). The effect receives a `stale` check it must consult before any setState that follows an
// `await`. The cleanup flips the flag, so `stale()` returns true for work that outlived the mount.
export function useAsyncEffect(effect: (stale: StaleCheck) => Promise<void>, deps: DependencyList): void {
  function runGuarded() {
    var active = true
    effect(() => !active)

    return () => { active = false }
  }
  // deps is forwarded verbatim from the caller, which owns the dependency list for the async work.
  useEffect(runGuarded, deps)
}
