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
  if (selection.activeTranscriptionProvider)
    return false

  selection.activeTranscriptionProvider = WHISPER_LOCAL_PROVIDER_ID
  selection.activeTranscriptionModel = WHISPER_LOCAL_MODEL_ID
  return true
}
