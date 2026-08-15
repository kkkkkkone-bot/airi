export interface CodexRealtimeVoice {
  id: string
  name: string
  description: string
}

/** Voices accepted by the experimental Codex app-server realtime transport. */
export const codexRealtimeVoices: readonly CodexRealtimeVoice[] = [
  { id: 'sol', name: 'Sol', description: '清晰、自然' },
  { id: 'marin', name: 'Marin', description: '温暖、沉稳' },
  { id: 'cedar', name: 'Cedar', description: '低沉、从容' },
  { id: 'juniper', name: 'Juniper', description: '明快、亲切' },
] as const

export const CODEX_DEFAULT_REALTIME_VOICE = 'sol'

export function resolveCodexRealtimeVoice(voice: string | null | undefined): string {
  return codexRealtimeVoices.some(candidate => candidate.id === voice)
    ? voice!
    : CODEX_DEFAULT_REALTIME_VOICE
}
