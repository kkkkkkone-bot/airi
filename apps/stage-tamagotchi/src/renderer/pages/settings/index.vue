<script setup lang="ts">
import type { CodexBridgeStatus } from '../../../shared/codex-bridge'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { IconItem } from '@proj-airi/stage-ui/components'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { electronCodexGetStatus } from '../../../shared/eventa'
import { splitCodexSettings } from '../../utils/codex-simple-settings'

const router = useRouter()
const resolveAnimation = ref<() => void>()
const { t } = useI18n()
const settingsStore = useSettings()
const getCodexStatus = useElectronEventaInvoke(electronCodexGetStatus)
const codexStatus = ref<CodexBridgeStatus | null>(null)
const codexStatusResolved = ref(false)
const advancedSettingsVisible = useLocalStorage('settings/codex/advanced-visible', false)

const removeBeforeEach = router.beforeEach(async (_, __, next) => {
  if (!settingsStore.usePageSpecificTransitions || settingsStore.disableTransitions) {
    next()
    return
  }

  await new Promise<void>((resolve) => {
    resolveAnimation.value = resolve
  })
  removeBeforeEach()
  next()
})

const allSettings = computed(() => {
  return router
    .getRoutes()
    .filter(route => route.meta?.settingsEntry)
    .sort((a, b) => (Number(a.meta?.order ?? 0) - Number(b.meta?.order ?? 0)))
    .map(route => ({
      title: route.meta?.titleKey ? t(route.meta.titleKey as string) : (route.meta?.title as string | undefined) ?? '',
      description: route.meta?.descriptionKey ? t(route.meta.descriptionKey as string) : (route.meta?.description as string | undefined) || '',
      icon: (route.meta?.icon as string | undefined) ?? '',
      to: route.path,
    }))
})

const splitSettings = computed(() => splitCodexSettings(allSettings.value))
const everydaySettings = computed(() => [
  {
    title: t('settings.codexSimple.voice.title'),
    description: t('settings.codexSimple.voice.description'),
    icon: 'i-solar:microphone-3-bold-duotone',
    to: '/settings/codex-voice',
  },
  ...splitSettings.value.everyday,
])

onMounted(async () => {
  try {
    codexStatus.value = await getCodexStatus()
  }
  catch (error) {
    console.warn('[settings] Failed to inspect Codex status:', error)
    codexStatus.value = { enabled: false }
  }
  finally {
    codexStatusResolved.value = true
  }
})
</script>

<template>
  <div flex="~ col gap-4" font-normal>
    <div
      v-if="codexStatus?.enabled"
      class="codex-ready-card"
      role="status"
    >
      <div class="codex-ready-icon" aria-hidden="true">
        <div i-solar:chat-round-check-bold-duotone />
      </div>
      <div min-w-0 flex-1>
        <div text-base font-600>
          {{ t('settings.codexSimple.connected.title') }}
        </div>
        <div mt-1 text-sm text="neutral-600 dark:neutral-300">
          {{ t('settings.codexSimple.connected.description') }}
        </div>
      </div>
      <div class="codex-ready-badge">
        <span class="codex-ready-dot" />
        {{ t('settings.codexSimple.connected.ready') }}
      </div>
    </div>

    <div v-if="!codexStatusResolved" class="h-24 animate-pulse rounded-4 bg-neutral-500/8" />

    <template v-else-if="codexStatus?.enabled">
      <div flex="~ col gap-4">
        <IconItem
          v-for="(setting, index) in everydaySettings"
          :key="setting.to"
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="250"
          :style="{ transitionDelay: `${index * 45}ms` }"
          :title="setting.title"
          :description="setting.description"
          :icon="setting.icon"
          :to="setting.to"
        />
      </div>

      <button
        type="button"
        class="advanced-settings-toggle"
        :aria-expanded="advancedSettingsVisible"
        @click="advancedSettingsVisible = !advancedSettingsVisible"
      >
        <span i-solar:settings-minimalistic-linear aria-hidden="true" />
        <span>{{ t('settings.codexSimple.advanced.title') }}</span>
        <span ml-auto text-xs text="neutral-500 dark:neutral-400">
          {{ t(advancedSettingsVisible ? 'settings.codexSimple.advanced.hide' : 'settings.codexSimple.advanced.show') }}
        </span>
        <span :class="advancedSettingsVisible ? 'i-solar:alt-arrow-up-linear' : 'i-solar:alt-arrow-down-linear'" aria-hidden="true" />
      </button>

      <div v-if="advancedSettingsVisible" flex="~ col gap-4" pb-12>
        <IconItem
          v-for="setting in splitSettings.advanced"
          :key="setting.to"
          :title="setting.title"
          :description="setting.description"
          :icon="setting.icon"
          :to="setting.to"
        />
      </div>
    </template>

    <div v-else flex="~ col gap-4" pb-12>
      <IconItem
        v-for="(setting, index) in allSettings"
        :key="setting.to"
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="250"
        :style="{
          transitionDelay: `${index * 50}ms`, // delay between each item, unocss doesn't support dynamic generation of classes now
        }"
        :title="setting.title"
        :description="setting.description"
        :icon="setting.icon"
        :to="setting.to"
      />
    </div>
    <div
      v-motion
      text="neutral-200/50 dark:neutral-600/20" pointer-events-none
      fixed top="[calc(100dvh-12rem)]" bottom-0 right--10 z--1
      :initial="{ scale: 0.9, opacity: 0, rotate: 180 }"
      :enter="{ scale: 1, opacity: 1, rotate: 0 }"
      :duration="500"
      size-60
      flex items-center justify-center
    >
      <div v-motion text="60" i-solar:settings-bold-duotone />
    </div>
  </div>
</template>

<style scoped>
.codex-ready-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-primary-500, #06b6d4) 22%, transparent);
  border-radius: 1rem;
  background:
    radial-gradient(circle at 90% 10%, rgb(34 211 238 / 10%), transparent 42%),
    color-mix(in srgb, var(--bg-color) 94%, #06b6d4 6%);
}

.codex-ready-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.875rem;
  background: rgb(6 182 212 / 12%);
  color: rgb(8 145 178);
  font-size: 1.5rem;
}

.codex-ready-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 0 0 auto;
  color: rgb(8 145 178);
  font-size: 0.75rem;
  font-weight: 600;
}

.codex-ready-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: rgb(34 197 94);
  box-shadow: 0 0 0 4px rgb(34 197 94 / 12%);
}

.advanced-settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgb(115 115 115 / 14%);
  border-radius: 0.875rem;
  color: rgb(115 115 115);
  text-align: left;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.advanced-settings-toggle:hover,
.advanced-settings-toggle:focus-visible {
  border-color: rgb(6 182 212 / 35%);
  background: rgb(6 182 212 / 5%);
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .advanced-settings-toggle {
    transition: none;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.title
  stageTransition:
    name: slide
</route>
