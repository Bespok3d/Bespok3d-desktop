// Modals paint in the order they open: each open claims the next stacking level above every modal
// already on screen, so a dialog opened later always sits over one opened earlier - whichever part of
// the tree mounted it. Levels reset once the last modal closes, keeping the whole band beneath the app
// header (z 120), which stays clickable above any modal so its dropdown/notification remain reachable.

export const MODAL_BASE_LEVEL = 100
export const MODAL_TOP_LEVEL = 119

var openModalCount = 0
var nextModalLevel = MODAL_BASE_LEVEL

export function acquireModalLevel(): number {
  const level = Math.min(nextModalLevel, MODAL_TOP_LEVEL)
  openModalCount = openModalCount + 1
  nextModalLevel = nextModalLevel + 1

  return level
}

export function releaseModalLevel(): void {
  openModalCount = openModalCount - 1
  if (openModalCount === 0) nextModalLevel = MODAL_BASE_LEVEL
}
