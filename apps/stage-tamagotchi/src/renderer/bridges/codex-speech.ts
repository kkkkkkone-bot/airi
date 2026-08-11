import type { VoiceInfo } from '@proj-airi/stage-ui/stores/providers/provider'

export const CODEX_SPEECH_PROVIDER_ID = 'kokoro-local'
export const CODEX_DEFAULT_SPEECH_VOICE_ID = 'zf_xiaoxiao'

export interface CodexSpeechSelection {
  activeSpeechModel: string
  activeSpeechProvider: string
  activeSpeechVoice?: VoiceInfo
  activeSpeechVoiceId: string
}
export function createCodexSpeechVoice(voiceId = CODEX_DEFAULT_SPEECH_VOICE_ID): VoiceInfo {
  return {
    id: voiceId,
    name: voiceId,
    provider: CODEX_SPEECH_PROVIDER_ID,
    languages: [{ code: 'zh-CN', title: '中文（普通话）' }],
    gender: voiceId.startsWith('zf_') ? 'female' : 'male',
  }
}

/** Applies a credential-free local voice without replacing an existing user voice. */
export function applyCodexSpeechDefaults(selection: CodexSpeechSelection, defaultModel: string) {
  const hasUserSelection = selection.activeSpeechProvider
    && selection.activeSpeechProvider !== 'speech-noop'
    && selection.activeSpeechProvider !== CODEX_SPEECH_PROVIDER_ID

  if (hasUserSelection)
    return false

  let changed = false
  if (selection.activeSpeechProvider !== CODEX_SPEECH_PROVIDER_ID) {
    selection.activeSpeechProvider = CODEX_SPEECH_PROVIDER_ID
    changed = true
  }
  if (!selection.activeSpeechModel) {
    selection.activeSpeechModel = defaultModel
    changed = true
  }
  if (!selection.activeSpeechVoiceId) {
    selection.activeSpeechVoiceId = CODEX_DEFAULT_SPEECH_VOICE_ID
    changed = true
  }
  if (!selection.activeSpeechVoice || selection.activeSpeechVoice.id !== selection.activeSpeechVoiceId) {
    selection.activeSpeechVoice = createCodexSpeechVoice(selection.activeSpeechVoiceId)
    changed = true
  }

  return changed
}
