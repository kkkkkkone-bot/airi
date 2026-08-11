import {
  WHISPER_LOCAL_MODEL_ID,
  WHISPER_LOCAL_PROVIDER_ID,
} from '@proj-airi/stage-ui/libs/providers/providers/whisper-local'

export interface HearingSelection {
  activeTranscriptionModel: string
  activeTranscriptionProvider: string
}

/** Applies a private, credential-free hearing default without replacing user settings. */
export function applyCodexHearingDefaults(selection: HearingSelection) {
  const shouldUseLocalWhisper = !selection.activeTranscriptionProvider
    || selection.activeTranscriptionProvider === 'browser-web-speech-api'
  if (!shouldUseLocalWhisper)
    return false

  selection.activeTranscriptionProvider = WHISPER_LOCAL_PROVIDER_ID
  selection.activeTranscriptionModel = WHISPER_LOCAL_MODEL_ID
  return true
}
