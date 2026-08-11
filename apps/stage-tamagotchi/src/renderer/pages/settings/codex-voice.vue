<script setup lang="ts">
import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProviderConfigStore } from '@proj-airi/stage-ui/stores/providers/config'
import { useProviderStore } from '@proj-airi/stage-ui/stores/providers/provider'
import { storeToRefs } from 'pinia'
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  CODEX_SPEECH_PROVIDER_ID,
  createCodexSpeechVoice,
} from '../../bridges/codex-speech'

const { t } = useI18n()
const speechStore = useSpeechStore()
const providersStore = useProviderStore()
const providerConfigStore = useProviderConfigStore()
const { activeSpeechModel, activeSpeechProvider, activeSpeechVoice, activeSpeechVoiceId } = storeToRefs(speechStore)

const voices = [
  { id: 'zf_xiaoxiao', nameKey: 'settings.codexSimple.voice.voices.xiaoxiao', toneKey: 'settings.codexSimple.voice.tones.warm' },
  { id: 'zf_xiaobei', nameKey: 'settings.codexSimple.voice.voices.xiaobei', toneKey: 'settings.codexSimple.voice.tones.bright' },
  { id: 'zf_xiaoyi', nameKey: 'settings.codexSimple.voice.voices.xiaoyi', toneKey: 'settings.codexSimple.voice.tones.soft' },
  { id: 'zm_yunxi', nameKey: 'settings.codexSimple.voice.voices.yunxi', toneKey: 'settings.codexSimple.voice.tones.calm' },
] as const

const previewingVoiceId = ref('')
const previewError = ref('')
let previewAudio: HTMLAudioElement | undefined
let previewUrl = ''

function ensureLocalVoiceReady() {
  providersStore.initializeProvider(CODEX_SPEECH_PROVIDER_ID)
  providersStore.forceProviderConfigured(CODEX_SPEECH_PROVIDER_ID)
  const defaultConfig = providersStore.getDefaultProviderConfig(CODEX_SPEECH_PROVIDER_ID) as Record<string, unknown>

  activeSpeechProvider.value = CODEX_SPEECH_PROVIDER_ID
  if (!activeSpeechModel.value)
    activeSpeechModel.value = String(defaultConfig.model ?? 'q4f16')
}

function selectVoice(voiceId: string) {
  ensureLocalVoiceReady()
  activeSpeechVoiceId.value = voiceId
  activeSpeechVoice.value = createCodexSpeechVoice(voiceId)
}

async function previewVoice(voiceId: string) {
  selectVoice(voiceId)
  previewError.value = ''
  previewingVoiceId.value = voiceId

  try {
    previewAudio?.pause()
    if (previewUrl)
      URL.revokeObjectURL(previewUrl)

    const provider = await providersStore.getProviderInstance(CODEX_SPEECH_PROVIDER_ID) as SpeechProviderWithExtraOptions<string, Record<string, unknown>>
    const buffer = await speechStore.speech(
      provider,
      activeSpeechModel.value,
      t('settings.codexSimple.voice.previewText'),
      voiceId,
      providerConfigStore.getProviderConfig(CODEX_SPEECH_PROVIDER_ID) ?? {},
    )

    previewUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
    previewAudio = new Audio(previewUrl)
    await previewAudio.play()
  }
  catch (error) {
    console.error('[codex-voice] Preview failed:', error)
    previewError.value = t('settings.codexSimple.voice.previewError')
  }
  finally {
    previewingVoiceId.value = ''
  }
}

onUnmounted(() => {
  previewAudio?.pause()
  if (previewUrl)
    URL.revokeObjectURL(previewUrl)
})
</script>

<template>
  <div class="voice-page">
    <div class="voice-managed-card">
      <div class="voice-managed-icon" i-solar:microphone-3-bold-duotone aria-hidden="true" />
      <div>
        <div font-600>
          {{ t('settings.codexSimple.voice.hearingTitle') }}
        </div>
        <div mt-1 text-sm text="neutral-600 dark:neutral-300">
          {{ t('settings.codexSimple.voice.hearingDescription') }}
        </div>
      </div>
      <div ml-auto class="automatic-badge">
        {{ t('settings.codexSimple.voice.automatic') }}
      </div>
    </div>

    <div>
      <h2 m-0 text-lg font-600>
        {{ t('settings.codexSimple.voice.chooseTitle') }}
      </h2>
      <p mb-0 mt-1 text-sm text="neutral-500 dark:neutral-400">
        {{ t('settings.codexSimple.voice.chooseDescription') }}
      </p>
    </div>

    <div class="voice-grid">
      <div
        v-for="voice in voices"
        :key="voice.id"
        class="voice-option"
        :class="{ 'voice-option-active': activeSpeechProvider === CODEX_SPEECH_PROVIDER_ID && activeSpeechVoiceId === voice.id }"
      >
        <button
          type="button"
          class="voice-select"
          :aria-pressed="activeSpeechProvider === CODEX_SPEECH_PROVIDER_ID && activeSpeechVoiceId === voice.id"
          @click="selectVoice(voice.id)"
        >
          <span class="voice-avatar" aria-hidden="true">
            <span :class="voice.id.startsWith('zf_') ? 'i-solar:woman-bold-duotone' : 'i-solar:man-bold-duotone'" />
          </span>
          <span min-w-0 flex-1 text-left>
            <span block font-600>{{ t(voice.nameKey) }}</span>
            <span mt-1 block text-sm text="neutral-500 dark:neutral-400">{{ t(voice.toneKey) }}</span>
          </span>
        </button>
        <button
          type="button"
          class="preview-button"
          :aria-label="t('settings.codexSimple.voice.preview')"
          @click="previewVoice(voice.id)"
        >
          <span v-if="previewingVoiceId === voice.id" i-svg-spinners:ring-resize aria-hidden="true" />
          <span v-else i-solar:play-bold aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="previewError" role="alert" m-0 text-sm text-red-500>
      {{ previewError }}
    </p>

    <p m-0 text-xs text="neutral-500 dark:neutral-400">
      {{ t('settings.codexSimple.voice.firstUseHint') }}
    </p>
  </div>
</template>

<style scoped>
.voice-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 3rem;
}

.voice-managed-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  border: 1px solid rgb(6 182 212 / 18%);
  border-radius: 1rem;
  background: rgb(6 182 212 / 6%);
}

.voice-managed-icon {
  flex: 0 0 auto;
  color: rgb(8 145 178);
  font-size: 1.65rem;
}

.automatic-badge {
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: rgb(34 197 94 / 10%);
  color: rgb(22 163 74);
  font-size: 0.72rem;
  font-weight: 600;
}

.voice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.voice-option {
  display: flex;
  align-items: center;
  padding: 0.35rem;
  border: 1px solid rgb(115 115 115 / 16%);
  border-radius: 1rem;
  background: rgb(115 115 115 / 4%);
  color: inherit;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.voice-option:hover,
.voice-option:focus-within {
  border-color: rgb(6 182 212 / 35%);
  background: rgb(6 182 212 / 5%);
  outline: none;
  transform: translateY(-1px);
}

.voice-select {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.75rem;
  padding: 0.525rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: inherit;
}

.voice-select:focus-visible {
  outline: 2px solid rgb(6 182 212 / 45%);
  outline-offset: 1px;
}

.voice-option-active {
  border-color: rgb(6 182 212 / 55%);
  background: rgb(6 182 212 / 9%);
  box-shadow: inset 0 0 0 1px rgb(6 182 212 / 12%);
}

.voice-avatar {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  background: rgb(6 182 212 / 10%);
  color: rgb(8 145 178);
  font-size: 1.25rem;
}

.preview-button {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(8 145 178);
}

.preview-button:hover,
.preview-button:focus-visible {
  background: rgb(6 182 212 / 12%);
  outline: none;
}

@media (max-width: 520px) {
  .voice-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-option {
    transition: none;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.codexSimple.voice.pageTitle
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
