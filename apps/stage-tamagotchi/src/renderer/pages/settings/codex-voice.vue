<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import {
  CODEX_DEFAULT_REALTIME_VOICE,
  codexRealtimeVoices,
  resolveCodexRealtimeVoice,
} from '../../utils/codex-realtime-voice'

const { t } = useI18n()
const activeVoice = useLocalStorage('settings/codex/realtime-voice', CODEX_DEFAULT_REALTIME_VOICE)

function selectVoice(voiceId: string) {
  activeVoice.value = resolveCodexRealtimeVoice(voiceId)
}
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
        v-for="voice in codexRealtimeVoices"
        :key="voice.id"
        class="voice-option"
        :class="{ 'voice-option-active': activeVoice === voice.id }"
      >
        <button
          type="button"
          class="voice-select"
          :aria-pressed="activeVoice === voice.id"
          @click="selectVoice(voice.id)"
        >
          <span class="voice-avatar" aria-hidden="true">
            <span i-solar:volume-loud-bold-duotone />
          </span>
          <span min-w-0 flex-1 text-left>
            <span block font-600>{{ voice.name }}</span>
            <span mt-1 block text-sm text="neutral-500 dark:neutral-400">{{ voice.description }}</span>
          </span>
        </button>
      </div>
    </div>

    <p m-0 text-xs text="neutral-500 dark:neutral-400">
      更改后会自动重连正在进行的 Codex Voice 对话，并立即使用新的音色。
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
