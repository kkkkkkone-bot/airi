export const WHISPER_MEL_BINS = 128
export const WHISPER_FEATURE_FRAMES = 3000

/** Static encoder shape required by Whisper Large V3 Turbo's ONNX graph. */
export function whisperWarmupShape(): [number, number, number] {
  return [1, WHISPER_MEL_BINS, WHISPER_FEATURE_FRAMES]
}
