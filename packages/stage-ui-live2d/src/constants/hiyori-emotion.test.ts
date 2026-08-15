import { describe, expect, it } from 'vitest'

import { resolveHiyoriEmotionMotion } from './hiyori-emotion'

describe('resolveHiyoriEmotionMotion', () => {
  it.each([
    ['我好开心，太好了！', 'hiyori_m06.motion3.json'],
    ['哇，居然成功了？', 'hiyori_m07.motion3.json'],
    ['恭喜你完成了，太棒了！', 'hiyori_m08.motion3.json'],
    ['本来以为能成功，结果还是失败了。', 'hiyori_m09.motion3.json'],
    ['很遗憾，这次没能完成。', 'hiyori_m10.motion3.json'],
    ['这让我有点不好意思。', 'hiyori_m04.motion3.json'],
  ])('maps %s to %s', (text, expectedMotion) => {
    expect(resolveHiyoriEmotionMotion(text)?.fileName).toBe(expectedMotion)
  })

  it('does not force an emotional motion for neutral replies', () => {
    expect(resolveHiyoriEmotionMotion('我已经整理好今天的计划。')).toBeUndefined()
  })
})
