import { describe, expect, it } from 'vitest'

import { createVoiceInputLoopGuard } from './voice-input-loop-guard'

describe('createVoiceInputLoopGuard', () => {
  it('allows the first transcript', () => {
    const guard = createVoiceInputLoopGuard()

    expect(guard.inspect('请帮我查看今天的待办事项', 1000))
      .toEqual({ allow: true, disableMicrophone: false })
  })

  it('blocks a repeated transcript and disables the microphone after another repeat', () => {
    const guard = createVoiceInputLoopGuard()
    const text = '请把本周的项目进度整理给我'

    guard.inspect(text, 1000)
    expect(guard.inspect(text, 2000)).toEqual({ allow: false, disableMicrophone: false })
    expect(guard.inspect(text, 3000)).toEqual({ allow: false, disableMicrophone: true })
  })

  it('recognizes expanded variants of the same external audio', () => {
    const guard = createVoiceInputLoopGuard()

    guard.inspect('请把本周的项目进度整理给我', 1000)
    expect(guard.inspect('请把本周的项目进度整理给我 然后发给团队', 2000))
      .toEqual({ allow: false, disableMicrophone: false })
  })

  it('allows different speech and resets the duplicate counter', () => {
    const guard = createVoiceInputLoopGuard()

    guard.inspect('请把本周的项目进度整理给我', 1000)
    guard.inspect('请把本周的项目进度整理给我', 2000)
    expect(guard.inspect('请帮我查看今天的待办事项', 3000))
      .toEqual({ allow: true, disableMicrophone: false })
  })

  it('blocks known external broadcast audio before it reaches chat', () => {
    const guard = createVoiceInputLoopGuard()
    const text = '优优独播剧场 YoYo Television Series Exclusive'

    expect(guard.inspect(text, 1000)).toEqual({ allow: false, disableMicrophone: false })
    expect(guard.inspect(text, 2000)).toEqual({ allow: false, disableMicrophone: true })
  })
})
