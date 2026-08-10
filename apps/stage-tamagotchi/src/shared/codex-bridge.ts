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

/** Events that the main process streams to an AIRI renderer. */
export type CodexBridgeEvent
  = | { type: 'text-delta', text: string }
    | { type: 'reasoning-delta', text: string }
    | { type: 'tool-start', itemId: string, tool: string, summary: string }
    | { type: 'tool-finish', itemId: string, tool: string, status: string }
    | { type: 'finish', threadId: string, turnId: string, status: 'completed' | 'interrupted' }
