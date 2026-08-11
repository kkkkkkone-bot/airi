import type { ProgressPayload } from '../../../inference/protocol'

import { encodeBase64 } from '@moeru/std/base64'
import { z } from 'zod'

import whisperWorkerUrl from '../../../workers/worker?worker&url'

import { createWhisperAdapter } from '../../../inference/adapters/whisper'
import { MODEL_NAMES } from '../../../inference/constants'
import { defineProvider } from '../registry'

export const WHISPER_LOCAL_PROVIDER_ID = 'whisper-local'
export const WHISPER_LOCAL_MODEL_ID = MODEL_NAMES.WHISPER

function progressMessage(progress: ProgressPayload) {
  if (progress.percent >= 0)
    console.info(`[Whisper Local] ${progress.message ?? 'Loading model'} (${Math.round(progress.percent)}%)`)
  else
    console.info(`[Whisper Local] ${progress.message ?? 'Loading model'}`)
}

export const providerWhisperLocal = defineProvider({
  id: WHISPER_LOCAL_PROVIDER_ID,
  name: 'Whisper (Local)',
  nameLocalize: () => 'Whisper (Local)',
  description: 'Private speech recognition that runs on this device.',
  descriptionLocalize: () => 'Private speech recognition that runs on this device.',
  tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
  icon: 'i-lobe-icons:huggingface',
  requiresCredentials: false,
  capabilities: {
    transcription: {
      protocol: 'http',
      generateOutput: true,
      streamOutput: false,
      streamInput: false,
    },
  },
  createProviderConfig: () => z.object({}),
  createProvider() {
    let adapter = createWhisperAdapter(whisperWorkerUrl)
    let loading: Promise<void> | undefined

    async function ensureLoaded() {
      if (adapter.state === 'ready')
        return

      if (adapter.state === 'error' || adapter.state === 'terminated') {
        adapter.terminate()
        adapter = createWhisperAdapter(whisperWorkerUrl)
        loading = undefined
      }

      loading ??= adapter.load(progressMessage).catch((error) => {
        loading = undefined
        throw error
      })
      await loading
    }

    return {
      transcription: (_model: string, options?: { language?: string }) => ({
        baseURL: 'http://whisper-local.invalid/v1/',
        model: WHISPER_LOCAL_MODEL_ID,
        fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (!(init?.body instanceof FormData))
            throw new Error('Whisper Local expected a transcription form.')

          const file = init.body.get('file')
          if (!(file instanceof Blob))
            throw new Error('Whisper Local expected an audio recording.')

          await ensureLoaded()
          const audio = encodeBase64(await file.arrayBuffer())
          const text = await adapter.transcribe({
            audio,
            language: options?.language?.trim() || 'en',
          })

          return Response.json({ text })
        },
      }),
      dispose: () => adapter.terminate(),
    }
  },
  validationRequiredWhen: () => false,
  extraMethods: {
    listModels: async () => [{
      id: WHISPER_LOCAL_MODEL_ID,
      name: 'Whisper Large V3 Turbo',
      provider: WHISPER_LOCAL_PROVIDER_ID,
      description: 'Local multilingual speech recognition.',
      contextLength: 0,
      deprecated: false,
    }],
  },
})
