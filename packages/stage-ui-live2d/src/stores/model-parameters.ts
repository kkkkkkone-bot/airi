import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { supportedControl, useL2dViewControl } from './view-control'

type BroadcastChannelEvents
  = | BroadcastChannelEventShouldUpdateView

interface BroadcastChannelEventShouldUpdateView {
  type: 'live2d-should-update-view'
}

export interface HiyoriEmotionMotionRequest {
  group: string
  index: number
  sequence: number
}

export const defaultModelParameters = {
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  leftEyeOpen: 1,
  rightEyeOpen: 1,
  leftEyeSmile: 0,
  rightEyeSmile: 0,
  leftEyebrowLR: 0,
  rightEyebrowLR: 0,
  leftEyebrowY: 0,
  rightEyebrowY: 0,
  leftEyebrowAngle: 0,
  rightEyebrowAngle: 0,
  leftEyebrowForm: 0,
  rightEyebrowForm: 0,
  mouthOpen: 0,
  mouthForm: 0,
  cheek: 0,
  bodyAngleX: 0,
  bodyAngleY: 0,
  bodyAngleZ: 0,
  breath: 0,
}

export const useLive2dParams = defineStore('live2d', () => {
  const { post, data } = useBroadcastChannel<BroadcastChannelEvents, BroadcastChannelEvents>({ name: 'airi-stores-stage-ui-live2d' })
  const shouldUpdateViewHooks = ref(new Set<() => void>())

  const onShouldUpdateView = (hook: () => void) => {
    shouldUpdateViewHooks.value.add(hook)
    return () => {
      shouldUpdateViewHooks.value.delete(hook)
    }
  }

  function shouldUpdateView() {
    post({ type: 'live2d-should-update-view' })
    shouldUpdateViewHooks.value.forEach(hook => hook())
  }

  watch(data, (event) => {
    if (event?.type === 'live2d-should-update-view') {
      shouldUpdateViewHooks.value.forEach(hook => hook())
    }
  })

  const currentMotion = useLocalStorageManualReset<{ group: string, index?: number }>('settings/live2d/current-motion', () => ({ group: 'Idle', index: 0 }))
  const availableMotions = useLocalStorageManualReset<{ motionName: string, motionIndex: number, fileName: string }[]>('settings/live2d/available-motions', () => [])
  const motionMap = useLocalStorageManualReset<Record<string, string>>('settings/live2d/motion-map', {})
  const hiyoriEmotionMotion = ref<HiyoriEmotionMotionRequest>()
  let hiyoriEmotionMotionSequence = 0
  const { position, scale, set: setViewControl } = useL2dViewControl()

  // Live2D model parameters
  const modelParameters = useLocalStorageManualReset<Record<string, number>>('settings/live2d/parameters', defaultModelParameters)

  /** Requests a one-shot emotional Hiyori action without changing the saved idle motion. */
  function requestHiyoriEmotionMotion(motion: { group: string, index: number }) {
    hiyoriEmotionMotionSequence += 1
    hiyoriEmotionMotion.value = { ...motion, sequence: hiyoriEmotionMotionSequence }
  }

  function resetState() {
    supportedControl.forEach(c => setViewControl(c))
    currentMotion.reset()
    availableMotions.reset()
    motionMap.reset()
    modelParameters.reset()
    hiyoriEmotionMotion.value = undefined
    shouldUpdateView()
  }

  return {
    position,
    currentMotion,
    availableMotions,
    motionMap,
    hiyoriEmotionMotion,
    scale,
    modelParameters,

    requestHiyoriEmotionMotion,
    onShouldUpdateView,
    shouldUpdateView,
    resetState,
  }
})
export { useL2dViewControl }
