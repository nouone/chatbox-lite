/** Account and upgrade UI is hidden by default; the preference is persisted in settings. */
export function isLocalInterface(showAccountFeatures = false): boolean {
  return !showAccountFeatures
}
