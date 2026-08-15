import { hiyoriMotions } from './hiyori-motions'

function includesAny(content: string, keywords: readonly string[]) {
  return keywords.some(keyword => content.includes(keyword))
}

/**
 * Chooses a one-shot Hiyori motion from a completed assistant reply.
 *
 * This deliberately stays local and deterministic: AIRI already has the
 * reply text, so it does not need another model call or an API key merely to
 * select an expressive gesture.
 */
export function resolveHiyoriEmotionMotion(text: string) {
  const content = text.trim().toLowerCase()
  if (!content)
    return undefined

  // A "pleasant surprise, then disappointment" needs to win before either
  // of its individual emotions.
  const hasTurn = includesAny(content, ['结果', '可是', '但是', '不过'])
  if (hasTurn && (
    includesAny(content, ['本来', '原以为', '还以为'])
    || includesAny(content, ['惊喜', '开心', '高兴'])
  )) {
    return hiyoriMotions[8]
  }

  if (includesAny(content, ['抱歉', '对不起', '遗憾', '可惜', '失望', '伤心', '难过', '没办法', '无法', '不能', '失败', '没能']))
    return hiyoriMotions[9]

  if (includesAny(content, ['天哪', '居然', '没想到', '真的吗', '不可思议', '惊讶', '哇']))
    return hiyoriMotions[6]

  if (includesAny(content, ['恭喜', '好耶', '太棒了', '做到了', '完成了', '成功了', '赢了', '庆祝']))
    return hiyoriMotions[7]

  if (includesAny(content, ['害羞', '不好意思', '脸红', '嘿嘿']))
    return hiyoriMotions[3]

  if (includesAny(content, ['开心', '高兴', '快乐', '太好了', '真棒', '哈哈', '很棒', '不错']))
    return hiyoriMotions[5]

  return undefined
}
