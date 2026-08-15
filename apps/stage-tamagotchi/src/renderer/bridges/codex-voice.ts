import type { CodexDesktopAudioEvent, CodexRealtimeEvent } from '../../shared/codex-bridge'

import { defineStreamInvoke } from '@moeru/eventa'
import { useElectronEventaContext, useElectronEventaInvoke } from '@proj-airi/electron-vueuse'

import {
  electronCodexStopDesktopAudio,
  electronCodexStopRealtime,
  electronCodexStreamDesktopAudio,
  electronCodexStreamRealtime,
} from '../../shared/eventa'

export interface CodexVoiceSessionOptions {
  conversationId: string
  stream: MediaStream
  voice?: string
  onAudioLevel?: (level: number) => void
  onEvent?: (event: CodexRealtimeEvent) => void
}

export interface CodexDesktopVoiceMonitorOptions {
  onAudioLevel?: (level: number) => void
  onError?: (message: string) => void
}

/** Owns one direct browser-to-Codex WebRTC voice session. */
export function createCodexVoiceBridge() {
  const context = useElectronEventaContext()
  const streamRealtime = defineStreamInvoke(context.value, electronCodexStreamRealtime)
  const stopRealtime = useElectronEventaInvoke(electronCodexStopRealtime)
  let peer: RTCPeerConnection | undefined
  let output: HTMLAudioElement | undefined
  let audioContext: AudioContext | undefined
  let animationFrame: number | undefined
  let activeConversationId: string | undefined

  function stopAudioMeter() {
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame)
      animationFrame = undefined
    }
  }

  function startAudioMeter(stream: MediaStream, onAudioLevel: ((level: number) => void) | undefined) {
    if (!onAudioLevel)
      return

    audioContext ??= new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    audioContext.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    const update = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const value = (sample - 128) / 128
        sum += value * value
      }
      onAudioLevel(Math.min(1, Math.sqrt(sum / samples.length) * 7))
      animationFrame = requestAnimationFrame(update)
    }
    update()
  }

  function cleanup() {
    stopAudioMeter()
    peer?.close()
    peer = undefined
    output?.pause()
    if (output)
      output.srcObject = null
    output = undefined
    activeConversationId = undefined
  }

  async function waitForIceGathering(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === 'complete')
      return

    await new Promise<void>((resolve, reject) => {
      let timeout: number | undefined
      const handleStateChange = () => {
        if (connection.iceGatheringState !== 'complete')
          return
        if (timeout !== undefined)
          window.clearTimeout(timeout)
        connection.removeEventListener('icegatheringstatechange', handleStateChange)
        resolve()
      }
      timeout = window.setTimeout(() => {
        connection.removeEventListener('icegatheringstatechange', handleStateChange)
        reject(new Error('Timed out while preparing the Codex Voice connection.'))
      }, 10_000)
      connection.addEventListener('icegatheringstatechange', handleStateChange)
    })
  }

  async function start(options: CodexVoiceSessionOptions) {
    if (activeConversationId)
      await stop(activeConversationId)

    const connection = new RTCPeerConnection()
    peer = connection
    activeConversationId = options.conversationId
    const track = options.stream.getAudioTracks()[0]
    if (!track)
      throw new Error('The selected microphone has no live audio track.')

    connection.addTrack(track, options.stream)
    connection.createDataChannel('oai-events')
    connection.ontrack = ({ streams, track: remoteTrack }) => {
      const remoteStream = streams[0] ?? new MediaStream([remoteTrack])
      output = new Audio()
      output.autoplay = true
      output.srcObject = remoteStream
      startAudioMeter(remoteStream, options.onAudioLevel)
      void audioContext?.resume()
      void output.play().catch(error => console.warn('[codex-voice] Unable to play Codex audio:', error))
    }
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed')
        options.onEvent?.({ type: 'error', message: 'Codex Voice WebRTC connection failed.' })
    }

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    await waitForIceGathering(connection)
    const sdp = connection.localDescription?.sdp
    if (!sdp)
      throw new Error('Could not create a WebRTC offer for Codex Voice.')

    try {
      for await (const event of streamRealtime({
        conversationId: options.conversationId,
        sdp,
        voice: options.voice,
      })) {
        if (event.type === 'sdp')
          await connection.setRemoteDescription({ type: 'answer', sdp: event.sdp })
        options.onEvent?.(event)
      }
    }
    finally {
      cleanup()
      options.onAudioLevel?.(0)
    }
  }

  async function stop(conversationId = activeConversationId) {
    if (!conversationId) {
      cleanup()
      return
    }

    try {
      await stopRealtime({ conversationId })
    }
    finally {
      cleanup()
    }
  }

  return { start, stop, cleanup }
}

/** Maps the Codex desktop process's output level to an avatar without capturing audio content. */
export function createCodexDesktopVoiceMonitor() {
  const context = useElectronEventaContext()
  const streamDesktopAudio = defineStreamInvoke(context.value, electronCodexStreamDesktopAudio)
  const stopDesktopAudio = useElectronEventaInvoke(electronCodexStopDesktopAudio)
  let running = false

  async function start(options: CodexDesktopVoiceMonitorOptions) {
    if (running)
      return

    running = true
    try {
      for await (const event of streamDesktopAudio(undefined)) {
        const desktopEvent = event as CodexDesktopAudioEvent
        if (desktopEvent.type === 'level')
          options.onAudioLevel?.(desktopEvent.level)
        else
          options.onError?.(desktopEvent.message)
      }
    }
    finally {
      running = false
      options.onAudioLevel?.(0)
    }
  }

  async function stop() {
    running = false
    await stopDesktopAudio()
  }

  return { start, stop }
}
