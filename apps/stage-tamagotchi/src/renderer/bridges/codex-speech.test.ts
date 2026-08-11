import { describe, expect, it } from 'vitest'

import { applyCodexSpeechDefaults } from './codex-speech'

describe('applyCodexSpeechDefaults', () => {
  it('turns the default silent output into a local Mandarin voice', () => {
    const selection = {
      activeSpeechProvider: 'speech-noop',
      activeSpeechModel: '',
      activeSpeechVoiceId: '',
    }

    expect(applyCodexSpeechDefaults(selection, 'windows-system')).toBe(true)
    expect(selection).toMatchObject({
      activeSpeechProvider: 'codex-system-speech',
      activeSpeechModel: 'windows-system',
      activeSpeechVoiceId: 'windows-auto',
      activeSpeechVoice: {
        id: 'windows-auto',
        provider: 'codex-system-speech',
      },
    })
  })

  it('preserves a voice provider selected by the user', () => {
    const selection = {
      activeSpeechProvider: 'elevenlabs',
      activeSpeechModel: 'eleven-v3',
      activeSpeechVoiceId: 'voice-1',
    }

    expect(applyCodexSpeechDefaults(selection, 'q4f16')).toBe(false)
    expect(selection).toEqual({
      activeSpeechProvider: 'elevenlabs',
      activeSpeechModel: 'eleven-v3',
      activeSpeechVoiceId: 'voice-1',
    })
  })

  it('migrates the legacy Kokoro default to the Windows system voice', () => {
    const selection = {
      activeSpeechProvider: 'kokoro-local',
      activeSpeechModel: 'q8',
      activeSpeechVoiceId: '',
    }

    expect(applyCodexSpeechDefaults(selection, 'windows-system')).toBe(true)
    expect(selection.activeSpeechProvider).toBe('codex-system-speech')
    expect(selection.activeSpeechModel).toBe('windows-system')
    expect(selection.activeSpeechVoiceId).toBe('windows-auto')
  })

  it('uses the safe local model when provider defaults are blank', () => {
    const selection = {
      activeSpeechProvider: 'speech-noop',
      activeSpeechModel: '',
      activeSpeechVoiceId: '',
    }

    expect(applyCodexSpeechDefaults(selection, '')).toBe(true)
    expect(selection.activeSpeechModel).toBe('windows-system')
  })
})
