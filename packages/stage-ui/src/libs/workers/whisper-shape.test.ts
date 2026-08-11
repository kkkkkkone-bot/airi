import { describe, expect, it } from 'vitest'

import { whisperWarmupShape } from './whisper-shape'

describe('whisper worker input shape', () => {
  it('warms up with the static 30-second feature window expected by the ONNX encoder', () => {
    expect(whisperWarmupShape()).toEqual([1, 128, 3000])
  })
})
