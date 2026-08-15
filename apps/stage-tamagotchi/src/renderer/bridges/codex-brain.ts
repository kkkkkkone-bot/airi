import type { StreamOptions } from '@proj-airi/stage-ui/stores/ai/chat-llm/llm'
import type { Message } from '@xsai/shared-chat'

import type { CodexBridgeEvent, CodexTurnRequest } from '../../shared/codex-bridge'

import { defineStreamInvoke } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useLLM } from '@proj-airi/stage-ui/stores/ai/chat-llm/llm'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { watch } from 'vue'

import {
  electronCodexGetStatus,
  electronCodexInterruptTurn,
  electronCodexStreamTurn,
} from '../../shared/eventa'
import { applyCodexHearingDefaults } from './codex-hearing'
import { applyCodexSpeechDefaults, CODEX_SPEECH_PROVIDER_ID } from './codex-speech'

function contentText(content: unknown): string {
  if (typeof content === 'string')
    return content
  if (!Array.isArray(content))
    return ''

  return content
    .map((part) => {
      if (typeof part !== 'object' || part === null || !('type' in part) || part.type !== 'text' || !('text' in part))
        return ''
      return typeof part.text === 'string' ? part.text : ''
    })
    .filter(Boolean)
    .join('\n')
}

function latestUserText(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.role === 'user') {
      const text = contentText(message.content).trim()
      if (text)
        return text
    }
  }
  return ''
}

function systemInstructions(messages: Message[]): string | undefined {
  const instructions = messages
    .filter(message => message.role === 'system')
    .map(message => contentText(message.content).trim())
    .filter(Boolean)
    .join('\n\n')
  return instructions || undefined
}

async function runCodexStream(
  messages: Message[],
  options: StreamOptions | undefined,
  streamTurn: (payload: CodexTurnRequest) => AsyncIterable<CodexBridgeEvent>,
  interruptTurn: (payload: { conversationId: string }) => Promise<void>,
) {
  const conversationId = options?.requestCorrelation?.conversationId
  if (!conversationId)
    throw new Error('Codex needs a conversation ID for this turn.')

  const text = latestUserText(messages)
  if (!text.trim())
    throw new Error('Codex could not find the latest user message.')

  const interrupt = () => {
    void interruptTurn({ conversationId }).catch(error => console.warn('[codex-brain] Failed to interrupt turn:', error))
  }
  if (options?.abortSignal?.aborted)
    throw new DOMException('The Codex turn was cancelled.', 'AbortError')
  options?.abortSignal?.addEventListener('abort', interrupt, { once: true })

  try {
    for await (const event of streamTurn({
      conversationId,
      instructions: systemInstructions(messages),
      text,
    })) {
      if (event.type === 'text-delta' || event.type === 'reasoning-delta')
        await options?.onStreamEvent?.(event)
      if (event.type === 'finish')
        await options?.onStreamEvent?.({ type: 'finish', finishReason: event.status === 'completed' ? 'stop' : 'interrupted' })
    }
  }
  finally {
    options?.abortSignal?.removeEventListener('abort', interrupt)
  }
}

/** Creates a renderer bridge that can replace AIRI provider streaming with Codex. */
export function createCodexBrainBridge() {
  const context = useElectronEventaContext()
  const getStatus = useElectronEventaInvoke(electronCodexGetStatus)
  const interruptTurn = useElectronEventaInvoke(electronCodexInterruptTurn)
  const streamTurn = defineStreamInvoke(context.value, electronCodexStreamTurn)
  const llm = useLLM()
  const hearing = useHearingStore()
  const speech = useSpeechStore()
  const providers = useProviderStore()
  let enabled = false
  let stopManagedSpeechGuard: (() => void) | undefined
  let stopManagedHearingGuard: (() => void) | undefined

  function applyManagedHearing() {
    if (applyCodexHearingDefaults(hearing))
      console.info('[codex-brain] Hearing defaulted to local Whisper')
  }

  function applyManagedSpeech() {
    providers.initializeProvider(CODEX_SPEECH_PROVIDER_ID)
    providers.forceProviderConfigured(CODEX_SPEECH_PROVIDER_ID)
    const speechConfig = providers.getDefaultProviderConfig(CODEX_SPEECH_PROVIDER_ID) as Record<string, unknown>
    if (applyCodexSpeechDefaults(speech, String(speechConfig.model ?? 'windows-system')))
      console.info('[codex-brain] Speech defaulted to the Windows system voice')
  }

  return {
    async initialize() {
      const status = await getStatus()
      enabled = status.enabled
      if (!enabled)
        return status

      applyManagedHearing()
      applyManagedSpeech()

      // Character-card sync can restore speech-noop after the bridge has
      // initialized. Keep the Codex-owned defaults stable without overriding
      // a user-selected external provider.
      stopManagedSpeechGuard = watch(
        () => speech.activeSpeechProvider,
        (provider) => {
          if (enabled && (provider === 'speech-noop' || provider === 'kokoro-local'))
            applyManagedSpeech()
        },
      )
      stopManagedHearingGuard = watch(
        () => hearing.activeTranscriptionProvider,
        (provider) => {
          if (enabled && (!provider || provider === 'browser-web-speech-api'))
            applyManagedHearing()
        },
      )

      llm.setStreamOverride(async (_model, _chatProvider, messages, options) => {
        await runCodexStream(messages, options, streamTurn, interruptTurn)
      })
      return status
    },
    dispose() {
      stopManagedSpeechGuard?.()
      stopManagedSpeechGuard = undefined
      stopManagedHearingGuard?.()
      stopManagedHearingGuard = undefined
      if (enabled)
        llm.setStreamOverride()
      enabled = false
    },
  }
}
