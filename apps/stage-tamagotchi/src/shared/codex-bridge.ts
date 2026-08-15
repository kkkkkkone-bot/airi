/** Runtime status for the optional Codex brain path. */
export interface CodexBridgeStatus {
  enabled: boolean
  workspace?: string
  reason?: string
}

/** Input for one AIRI user turn that Codex handles. */
export interface CodexTurnRequest {
  conversationId: string
  instructions?: string
  text: string
}

/** Correlation data for an active Codex turn. */
export interface CodexTurnReference {
  conversationId: string
}

/** Inputs needed to open Codex's experimental native voice session. */
export interface CodexRealtimeRequest {
  conversationId: string
  sdp: string
  voice?: string
}

/** Events emitted while Codex owns the WebRTC voice conversation. */
export type CodexRealtimeEvent
  = | { type: 'sdp', sdp: string }
    | { type: 'started', threadId: string, realtimeSessionId?: string }
    | { type: 'transcript-delta', role: string, text: string }
    | { type: 'transcript-done', role: string, text: string }
    | { type: 'closed', reason?: string }
    | { type: 'error', message: string }

/** A privacy-preserving output-level sample from the Codex desktop process. */
export type CodexDesktopAudioEvent
  = | { type: 'level', level: number }
    | { type: 'error', message: string }

/** Events that the main process streams to an AIRI renderer. */
export type CodexBridgeEvent
  = | { type: 'text-delta', text: string }
    | { type: 'reasoning-delta', text: string }
    | { type: 'tool-start', itemId: string, tool: string, summary: string }
    | { type: 'tool-finish', itemId: string, tool: string, status: string }
    | { type: 'finish', threadId: string, turnId: string, status: 'completed' | 'interrupted' }
