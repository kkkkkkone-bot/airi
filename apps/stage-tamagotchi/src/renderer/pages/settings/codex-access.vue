<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

const fullAccess = useLocalStorage('settings/codex/full-access', false)

function setFullAccess(enabled: boolean) {
  fullAccess.value = enabled
}
</script>

<template>
  <div class="access-page">
    <div class="access-card" :class="fullAccess ? 'access-card-danger' : 'access-card-safe'">
      <div class="access-icon" :class="fullAccess ? 'i-solar:danger-triangle-bold-duotone' : 'i-solar:shield-check-bold-duotone'" aria-hidden="true" />
      <div min-w-0 flex-1>
        <h2 m-0 text-lg font-600>
          {{ fullAccess ? '完全访问已开启' : '工作区访问' }}
        </h2>
        <p mb-0 mt-1 text-sm text="neutral-600 dark:neutral-300">
          {{ fullAccess ? '小F 可以操作本机文件、运行本地命令与访问网络。' : '小F 只能修改当前 AIRI 项目，无法访问其它文件。' }}
        </p>
      </div>
    </div>

    <label class="access-option">
      <input :checked="fullAccess" type="checkbox" @change="setFullAccess(($event.target as HTMLInputElement).checked)">
      <span>
        <span block font-600>允许完全访问本机</span>
        <span mt-1 block text-sm text="neutral-500 dark:neutral-400">启用后，下一次任务会使用 Codex 的完全访问权限。</span>
      </span>
    </label>

    <p m-0 text-sm text="neutral-500 dark:neutral-400">
      删除、覆盖或发送内容前，请在对话中明确说明目标。关闭此开关即可立即恢复工作区限制。
    </p>
  </div>
</template>

<style scoped>
.access-page { display: flex; flex-direction: column; gap: 1.25rem; padding-bottom: 3rem; }
.access-card, .access-option { display: flex; align-items: center; gap: .875rem; padding: 1rem; border: 1px solid rgb(115 115 115 / 16%); border-radius: 1rem; }
.access-card-safe { background: rgb(34 197 94 / 6%); }
.access-card-danger { border-color: rgb(239 68 68 / 35%); background: rgb(239 68 68 / 7%); }
.access-icon { flex: 0 0 auto; font-size: 1.65rem; }
.access-card-safe .access-icon { color: rgb(22 163 74); }
.access-card-danger .access-icon { color: rgb(220 38 38); }
.access-option { cursor: pointer; }
.access-option input { width: 1.2rem; height: 1.2rem; accent-color: rgb(8 145 178); }
</style>

<route lang="yaml">
meta:
  layout: settings
  title: 任务权限
  subtitle: 设置
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
