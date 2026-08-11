const DUPLICATE_WINDOW_MS = 20_000
const MINIMUM_COMPARABLE_TEXT_LENGTH = 12
const DISABLE_MICROPHONE_AFTER_DUPLICATES = 2
const KNOWN_EXTERNAL_BROADCAST_TRANSCRIPTS = [
  '优优独播剧场yoyotelevisionseriesexclusive',
  '字幕志愿者杨茜茜',
]

export interface VoiceInputLoopDecision {
  allow: boolean
  disableMicrophone: boolean
}

/**
 * Prevents persistent external audio (for example, a system loopback device)
 * from being sent to the chat repeatedly after speech recognition.
 */
export function createVoiceInputLoopGuard() {
  let previousText = ''
  let previousAt = 0
  let duplicateCount = 0
  let blockedBroadcastCount = 0

  function reset() {
    previousText = ''
    previousAt = 0
    duplicateCount = 0
    blockedBroadcastCount = 0
  }

  function inspect(text: string, now = Date.now()): VoiceInputLoopDecision {
    const normalizedText = normalizeVoiceInput(text)
    if (!normalizedText)
      return { allow: false, disableMicrophone: false }

    if (isKnownExternalBroadcast(normalizedText)) {
      blockedBroadcastCount += 1
      return {
        allow: false,
        disableMicrophone: blockedBroadcastCount >= DISABLE_MICROPHONE_AFTER_DUPLICATES,
      }
    }

    blockedBroadcastCount = 0

    const isWithinDuplicateWindow = now - previousAt <= DUPLICATE_WINDOW_MS
    const isDuplicate = isWithinDuplicateWindow
      && areRelatedTranscripts(previousText, normalizedText)

    previousText = normalizedText
    previousAt = now

    if (!isDuplicate) {
      duplicateCount = 0
      return { allow: true, disableMicrophone: false }
    }

    duplicateCount += 1
    return {
      allow: false,
      disableMicrophone: duplicateCount >= DISABLE_MICROPHONE_AFTER_DUPLICATES,
    }
  }

  return { inspect, reset }
}

function normalizeVoiceInput(text: string) {
  return text
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

function areRelatedTranscripts(first: string, second: string) {
  if (!first || !second)
    return false

  const shorterText = first.length <= second.length ? first : second
  const longerText = first.length <= second.length ? second : first

  return shorterText.length >= MINIMUM_COMPARABLE_TEXT_LENGTH
    && longerText.includes(shorterText)
}

function isKnownExternalBroadcast(text: string) {
  return KNOWN_EXTERNAL_BROADCAST_TRANSCRIPTS.some(broadcast => text.includes(broadcast))
}
