import { z } from 'zod'

import { defineProvider } from '../registry'

export const CODEX_SYSTEM_SPEECH_PROVIDER_ID = 'codex-system-speech'
export const CODEX_SYSTEM_SPEECH_MODEL_ID = 'windows-system'
export const CODEX_SYSTEM_SPEECH_VOICE_ID = 'windows-auto'

interface SystemSpeechResult {
  data: Uint8Array
  voiceName: string
}

type SystemSpeechInvoke = (request: { text: string, language?: string }) => Promise<SystemSpeechResult>

let systemSpeechInvoke: SystemSpeechInvoke | undefined

/** Connects the shared provider definition to the Electron renderer bridge. */
export function configureCodexSystemSpeechProvider(synthesize: SystemSpeechInvoke) {
  systemSpeechInvoke = synthesize
}

export const providerCodexSystemSpeech = defineProvider({
  id: CODEX_SYSTEM_SPEECH_PROVIDER_ID,
  name: 'Windows system voice',
  nameLocalize: () => 'Windows system voice',
  description: 'Uses an installed Windows voice without an API key.',
  descriptionLocalize: () => 'Uses an installed Windows voice without an API key.',
  tasks: ['text-to-speech', 'tts'],
  icon: 'i-solar:volume-loud-bold-duotone',
  requiresCredentials: false,
  createProviderConfig: () => z.object({
    language: z.string().default('zh-CN'),
  }),
  createProvider(config) {
    return {
      speech: () => ({
        baseURL: 'http://codex-system-speech.local/v1/',
        model: CODEX_SYSTEM_SPEECH_MODEL_ID,
        fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (!init?.body || typeof init.body !== 'string')
            throw new Error('Invalid system speech request body.')
          if (!systemSpeechInvoke)
            throw new Error('The desktop system speech bridge is unavailable.')

          const body = JSON.parse(init.body) as { input?: string }
          const result = await systemSpeechInvoke({
            text: body.input ?? '',
            language: config.language || 'zh-CN',
          })
          const audio = Uint8Array.from(result.data)
          return new Response(audio.buffer, {
            status: 200,
            headers: { 'Content-Type': 'audio/wav' },
          })
        },
      }),
    }
  },
  validationRequiredWhen: () => false,
  extraMethods: {
    listModels: async () => [{
      id: CODEX_SYSTEM_SPEECH_MODEL_ID,
      name: 'Windows system voice',
      provider: CODEX_SYSTEM_SPEECH_PROVIDER_ID,
    }],
    listVoices: async () => [{
      id: CODEX_SYSTEM_SPEECH_VOICE_ID,
      name: 'Automatic system voice',
      provider: CODEX_SYSTEM_SPEECH_PROVIDER_ID,
      languages: [{ code: 'zh-CN', title: '中文（普通话）' }],
    }],
  },
})
