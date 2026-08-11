import { describe, expect, it } from 'vitest'

import { applyCodexSpeechDefaults } from './codex-speech'

describe('applyCodexSpeechDefaults', () => {
  it('turns the default silent output into a local Mandarin voice', () => {
    const selection = {
      activeSpeechProvider: 'speech-noop',
      activeSpeechModel: '',
      activeSpeechVoiceId: '',
    }

    expect(applyCodexSpeechDefaults(selection, 'q4f16')).toBe(true)
    expect(selection).toMatchObject({
      activeSpeechProvider: 'kokoro-local',
      activeSpeechModel: 'q4f16',
      activeSpeechVoiceId: 'zf_xiaoxiao',
      activeSpeechVoice: {
        id: 'zf_xiaoxiao',
        provider: 'kokoro-local',
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

  it('repairs an incomplete local voice selection', () => {
    const selection = {
      activeSpeechProvider: 'kokoro-local',
      activeSpeechModel: 'q8',
      activeSpeechVoiceId: '',
    }

    expect(applyCodexSpeechDefaults(selection, 'q4f16')).toBe(true)
    expect(selection.activeSpeechModel).toBe('q8')
    expect(selection.activeSpeechVoiceId).toBe('zf_xiaoxiao')
  })
})
