import { describe, expect, it } from 'vitest'

import { getHiyoriMotion, hiyoriSpeakingMotions } from './hiyori-motions'

describe('hiyori motion semantics', () => {
  it('uses the requested speaking rotation', () => {
    expect(hiyoriSpeakingMotions.map(motion => motion.fileName)).toEqual([
      'hiyori_m01.motion3.json',
      'hiyori_m02.motion3.json',
      'hiyori_m05.motion3.json',
      'hiyori_m03.motion3.json',
    ])
  })

  it('keeps the emotional labels attached to their motion files', () => {
    expect(getHiyoriMotion('motion/hiyori_m04.motion3.json')?.label).toBe('害羞')
    expect(getHiyoriMotion('motion/hiyori_m10.motion3.json')?.label).toBe('失望 / 伤心')
  })
})
