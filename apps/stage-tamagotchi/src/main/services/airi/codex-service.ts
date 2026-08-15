import type { createContext } from '@moeru/eventa/adapters/electron/main'

import type { CodexBridgeManager } from './codex-bridge'

import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'

import {
  electronCodexGetStatus,
  electronCodexInterruptTurn,
  electronCodexStopRealtime,
  electronCodexStreamRealtime,
  electronCodexStreamTurn,
} from '../../../shared/eventa'

/** Registers the process-wide Codex bridge for every AIRI renderer. */
export function createCodexService(params: {
  context: ReturnType<typeof createContext>['context']
  manager: CodexBridgeManager
}) {
  defineInvokeHandler(params.context, electronCodexGetStatus, () => params.manager.getStatus())
  defineInvokeHandler(params.context, electronCodexInterruptTurn, payload => params.manager.interruptTurn(payload.conversationId))
  defineInvokeHandler(params.context, electronCodexStopRealtime, payload => params.manager.stopRealtime(payload.conversationId))
  defineStreamInvokeHandler(params.context, electronCodexStreamTurn, toStreamHandler(async ({ payload, emit }) => {
    await params.manager.runTurn(payload, emit)
  }))
  defineStreamInvokeHandler(params.context, electronCodexStreamRealtime, toStreamHandler(async ({ payload, emit }) => {
    await params.manager.runRealtime(payload, emit)
  }))
}
