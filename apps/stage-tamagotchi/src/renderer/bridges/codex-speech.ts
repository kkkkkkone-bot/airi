import type { VoiceInfo } from '@proj-airi/stage-ui/stores/providers/provider'

import {
  CODEX_SYSTEM_SPEECH_MODEL_ID,
  CODEX_SYSTEM_SPEECH_PROVIDER_ID,
  CODEX_SYSTEM_SPEECH_VOICE_ID,
} from '@proj-airi/stage-ui/libs/providers'

export const CODEX_SPEECH_PROVIDER_ID = CODEX_SYSTEM_SPEECH_PROVIDER_ID
export const CODEX_DEFAULT_SPEECH_VOICE_ID = CODEX_SYSTEM_SPEECH_VOICE_ID
const LEGACY_CODEX_SPEECH_PROVIDER_ID = 'kokoro-local'

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
    gender: 'female',
  }
}

/** Applies a credential-free local voice without replacing an existing user voice. */
export function applyCodexSpeechDefaults(selection: CodexSpeechSelection, defaultModel: string) {
  const resolvedDefaultModel = defaultModel.trim() || CODEX_SYSTEM_SPEECH_MODEL_ID
  const previousProvider = selection.activeSpeechProvider
  const isLegacyManagedVoice = previousProvider === LEGACY_CODEX_SPEECH_PROVIDER_ID
  const hasUserSelection = selection.activeSpeechProvider
    && selection.activeSpeechProvider !== 'speech-noop'
    && selection.activeSpeechProvider !== CODEX_SPEECH_PROVIDER_ID
    && !isLegacyManagedVoice

  if (hasUserSelection)
    return false

  let changed = false
  if (selection.activeSpeechProvider !== CODEX_SPEECH_PROVIDER_ID) {
    selection.activeSpeechProvider = CODEX_SPEECH_PROVIDER_ID
    changed = true
  }
  if (!selection.activeSpeechModel || isLegacyManagedVoice) {
    selection.activeSpeechModel = resolvedDefaultModel
    changed = true
  }
  if (!selection.activeSpeechVoiceId || isLegacyManagedVoice) {
    selection.activeSpeechVoiceId = CODEX_DEFAULT_SPEECH_VOICE_ID
    changed = true
  }
  if (!selection.activeSpeechVoice || selection.activeSpeechVoice.id !== selection.activeSpeechVoiceId) {
    selection.activeSpeechVoice = createCodexSpeechVoice(selection.activeSpeechVoiceId)
    changed = true
  }

  return changed
}
