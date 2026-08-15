export interface HiyoriMotion {
  fileName: string
  group: string
  index: number
  label: string
}

/** User-authored semantic labels for the bundled Hiyori Live2D motions. */
export const hiyoriMotions = [
  { fileName: 'hiyori_m01.motion3.json', group: 'Idle', index: 0, label: '说话 · 自然待机 A' },
  { fileName: 'hiyori_m02.motion3.json', group: 'Idle', index: 1, label: '说话 · 自然待机 B' },
  { fileName: 'hiyori_m03.motion3.json', group: 'Flick', index: 0, label: '说话 · 轻微手势' },
  { fileName: 'hiyori_m04.motion3.json', group: 'FlickDown', index: 0, label: '害羞' },
  { fileName: 'hiyori_m05.motion3.json', group: 'Idle', index: 2, label: '说话 · 自然待机 C' },
  { fileName: 'hiyori_m06.motion3.json', group: 'FlickUp', index: 0, label: '开心' },
  { fileName: 'hiyori_m07.motion3.json', group: 'Tap', index: 0, label: '惊讶' },
  { fileName: 'hiyori_m08.motion3.json', group: 'Tap', index: 1, label: '欢呼' },
  { fileName: 'hiyori_m09.motion3.json', group: 'Tap@Body', index: 0, label: '惊喜后泄气' },
  { fileName: 'hiyori_m10.motion3.json', group: 'Flick@Body', index: 0, label: '失望 / 伤心' },
] as const satisfies readonly HiyoriMotion[]

export const hiyoriSpeakingMotions = [
  hiyoriMotions[0],
  hiyoriMotions[1],
  hiyoriMotions[4],
  hiyoriMotions[2],
] as const

export function getHiyoriMotion(fileName: string) {
  return hiyoriMotions.find(motion => fileName.endsWith(motion.fileName))
}
