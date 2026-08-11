export interface SettingsEntry {
  description: string
  icon: string
  title: string
  to: string
}
const SIMPLE_SETTING_PATHS = new Set([
  '/settings/airi-card',
  '/settings/scene',
  '/settings/models',
  '/settings/system',
])

export function splitCodexSettings(entries: SettingsEntry[]) {
  return entries.reduce<{ advanced: SettingsEntry[], everyday: SettingsEntry[] }>((result, entry) => {
    if (SIMPLE_SETTING_PATHS.has(entry.to))
      result.everyday.push(entry)
    else
      result.advanced.push(entry)
    return result
  }, { advanced: [], everyday: [] })
}

export function shouldOpenProviderOnboarding(needsOnboarding: boolean, codexEnabled: boolean) {
  return needsOnboarding && !codexEnabled
}
