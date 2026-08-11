import { describe, expect, it } from 'vitest'

import { shouldOpenProviderOnboarding, splitCodexSettings } from './codex-simple-settings'

describe('codex simple mode', () => {
  it('keeps everyday character settings separate from technical settings', () => {
    const entries = [
      { title: 'Character', description: '', icon: '', to: '/settings/models' },
      { title: 'Providers', description: '', icon: '', to: '/settings/providers' },
      { title: 'Memory', description: '', icon: '', to: '/settings/memory' },
    ]

    expect(splitCodexSettings(entries)).toEqual({
      everyday: [entries[0]],
      advanced: [entries[1], entries[2]],
    })
  })

  it('skips provider onboarding when Codex is already the brain', () => {
    expect(shouldOpenProviderOnboarding(true, true)).toBe(false)
    expect(shouldOpenProviderOnboarding(true, false)).toBe(true)
  })
})
