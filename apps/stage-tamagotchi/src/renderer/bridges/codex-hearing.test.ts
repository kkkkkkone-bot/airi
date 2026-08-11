import { describe, expect, it } from 'vitest'

import { applyCodexHearingDefaults } from './codex-hearing'

describe('applyCodexHearingDefaults', () => {
  it('selects local Whisper when hearing has not been configured', () => {
    const selection = {
      activeTranscriptionProvider: '',
      activeTranscriptionModel: '',
    }

    expect(applyCodexHearingDefaults(selection)).toBe(true)
    expect(selection).toEqual({
      activeTranscriptionProvider: 'whisper-local',
      activeTranscriptionModel: 'whisper-large-v3-turbo',
    })
  })

  it('preserves an existing hearing provider and model', () => {
    const selection = {
      activeTranscriptionProvider: 'openai-audio-transcription',
      activeTranscriptionModel: 'whisper-1',
    }

    expect(applyCodexHearingDefaults(selection)).toBe(false)
    expect(selection).toEqual({
      activeTranscriptionProvider: 'openai-audio-transcription',
      activeTranscriptionModel: 'whisper-1',
    })
  })

  it('migrates the unsupported Electron Web Speech provider to local Whisper', () => {
    const selection = {
      activeTranscriptionProvider: 'browser-web-speech-api',
      activeTranscriptionModel: 'web-speech-api',
    }

    expect(applyCodexHearingDefaults(selection)).toBe(true)
    expect(selection).toEqual({
      activeTranscriptionProvider: 'whisper-local',
      activeTranscriptionModel: 'whisper-large-v3-turbo',
    })
  })
})
