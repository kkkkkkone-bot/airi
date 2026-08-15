import type { ChildProcess, ChildProcessWithoutNullStreams } from 'node:child_process'

import type { CodexBridgeEvent, CodexBridgeStatus, CodexDesktopAudioEvent, CodexRealtimeEvent, CodexRealtimeRequest, CodexTurnRequest } from '../../../shared/codex-bridge'

import process from 'node:process'
import readline from 'node:readline'

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import { errorMessageFrom } from '@moeru/std'
import { app } from 'electron'

import { onAppBeforeQuit } from '../../libs/bootkit/lifecycle'

type JsonRpcId = number | string

interface JsonRpcRequest {
  id: JsonRpcId
  method: string
  params?: unknown
}

interface JsonRpcNotification {
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  id: JsonRpcId
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse

interface PendingRequest {
  method: string
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export interface CodexLineTransport {
  write: (line: string) => void
  onLine: (listener: (line: string) => void) => () => void
  onClose: (listener: (error?: Error) => void) => () => void
  close: () => Promise<void>
}

export interface CodexBridgeManager {
  getStatus: () => CodexBridgeStatus
  runTurn: (request: CodexTurnRequest, onEvent: (event: CodexBridgeEvent) => void | Promise<void>) => Promise<void>
  runRealtime: (request: CodexRealtimeRequest, onEvent: (event: CodexRealtimeEvent) => void | Promise<void>) => Promise<void>
  runDesktopAudioMonitor: (onEvent: (event: CodexDesktopAudioEvent) => void | Promise<void>) => Promise<void>
  interruptTurn: (conversationId: string) => Promise<void>
  stopRealtime: (conversationId: string) => Promise<void>
  stopDesktopAudioMonitor: () => Promise<void>
  stop: () => Promise<void>
}

export interface CodexBridgeManagerOptions {
  enabled: boolean
  workspace?: string
  command?: string
  createTransport?: () => CodexLineTransport
  isDirectory?: (path: string) => boolean
}

interface ActiveTurn {
  conversationId: string
  threadId?: string
  turnId?: string
  interruptRequested: boolean
}

interface ActiveRealtime {
  conversationId: string
  threadId: string
  finish: () => void
}

interface ActiveDesktopAudioMonitor {
  child: ChildProcess
  finish: () => void
}

function resolveCodexOutputMeterPath() {
  const path = app.isPackaged
    ? join(process.resourcesPath, 'codex-output-meter.ps1')
    : join(app.getAppPath(), 'resources', 'codex-output-meter.ps1')
  return existsSync(path) ? path : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value))
    return undefined
  const result = value[field]
  return typeof result === 'string' ? result : undefined
}

function nestedString(value: unknown, parent: string, field: string): string | undefined {
  if (!isRecord(value))
    return undefined
  return stringField(value[parent], field)
}

function isJsonRpcResponse(message: JsonRpcMessage): message is JsonRpcResponse {
  return 'id' in message && !('method' in message)
}

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (!isRecord(value))
    return false
  const hasId = typeof value.id === 'number' || typeof value.id === 'string'
  const hasMethod = typeof value.method === 'string'
  return hasMethod || hasId
}

function eventThreadId(message: JsonRpcMessage): string | undefined {
  if (!('method' in message))
    return undefined
  return stringField(message.params, 'threadId')
}

function eventTurnId(message: JsonRpcMessage): string | undefined {
  if (!('method' in message) || !isRecord(message.params))
    return undefined
  return stringField(message.params, 'turnId') ?? stringField(message.params.turn, 'id')
}

function turnFailure(message: JsonRpcMessage): Error | undefined {
  if (!('method' in message) || message.method !== 'turn/completed' || !isRecord(message.params) || !isRecord(message.params.turn))
    return undefined
  const error = message.params.turn.error
  if (!isRecord(error))
    return undefined
  return new Error(stringField(error, 'message') ?? 'Codex turn failed')
}

function mapBridgeEvent(message: JsonRpcMessage): CodexBridgeEvent | undefined {
  if (!('method' in message))
    return undefined

  if (message.method === 'item/agentMessage/delta') {
    const text = stringField(message.params, 'delta')
    return text ? { type: 'text-delta', text } : undefined
  }

  if (message.method === 'item/reasoning/summaryTextDelta' || message.method === 'item/reasoning/textDelta') {
    const text = stringField(message.params, 'delta')
    return text ? { type: 'reasoning-delta', text } : undefined
  }

  if ((message.method === 'item/started' || message.method === 'item/completed') && isRecord(message.params) && isRecord(message.params.item)) {
    const item = message.params.item
    const itemId = stringField(item, 'id')
    const tool = stringField(item, 'type')
    if (!itemId || !tool || !['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall'].includes(tool))
      return undefined

    if (message.method === 'item/started') {
      const summary = stringField(item, 'command') ?? stringField(item, 'tool') ?? tool
      return { type: 'tool-start', itemId, tool, summary }
    }

    return {
      type: 'tool-finish',
      itemId,
      tool,
      status: stringField(item, 'status') ?? 'completed',
    }
  }

  return undefined
}

function mapRealtimeEvent(message: JsonRpcMessage): CodexRealtimeEvent | undefined {
  if (!('method' in message))
    return undefined

  if (message.method === 'thread/realtime/sdp') {
    const sdp = stringField(message.params, 'sdp')
    return sdp ? { type: 'sdp', sdp } : undefined
  }

  if (message.method === 'thread/realtime/started') {
    const threadId = stringField(message.params, 'threadId')
    return threadId
      ? { type: 'started', threadId, realtimeSessionId: stringField(message.params, 'realtimeSessionId') }
      : undefined
  }

  if (message.method === 'thread/realtime/transcript/delta') {
    const text = stringField(message.params, 'delta')
    const role = stringField(message.params, 'role')
    return text && role ? { type: 'transcript-delta', role, text } : undefined
  }

  if (message.method === 'thread/realtime/transcript/done') {
    const text = stringField(message.params, 'text')
    const role = stringField(message.params, 'role')
    return text && role ? { type: 'transcript-done', role, text } : undefined
  }

  if (message.method === 'thread/realtime/closed')
    return { type: 'closed', reason: stringField(message.params, 'reason') }

  if (message.method === 'thread/realtime/error')
    return { type: 'error', message: stringField(message.params, 'message') ?? 'Codex Voice failed' }
}

class JsonRpcClient {
  readonly #transport: CodexLineTransport
  readonly #pending = new Map<JsonRpcId, PendingRequest>()
  readonly #messageListeners = new Set<(message: JsonRpcMessage) => void | Promise<void>>()
  readonly #closeListeners = new Set<(error: Error) => void>()
  #nextId = 1
  #closed = false

  constructor(transport: CodexLineTransport) {
    this.#transport = transport
    transport.onLine(line => this.#receive(line))
    transport.onClose(error => this.#handleClose(error ?? new Error('Codex app-server closed')))
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.#closed)
      return Promise.reject(new Error('Codex app-server client is closed'))

    const id = this.#nextId++
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { method, resolve, reject })
      this.#transport.write(JSON.stringify({ id, method, params } satisfies JsonRpcRequest))
    })
  }

  notify(method: string, params?: unknown): void {
    if (this.#closed)
      throw new Error('Codex app-server client is closed')
    this.#transport.write(JSON.stringify({ method, params } satisfies JsonRpcNotification))
  }

  onMessage(listener: (message: JsonRpcMessage) => void | Promise<void>): () => void {
    this.#messageListeners.add(listener)
    return () => this.#messageListeners.delete(listener)
  }

  onClose(listener: (error: Error) => void): () => void {
    this.#closeListeners.add(listener)
    return () => this.#closeListeners.delete(listener)
  }

  async close(): Promise<void> {
    this.#handleClose(new Error('Codex app-server client stopped'))
    await this.#transport.close()
  }

  #receive(line: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    }
    catch {
      return
    }
    if (!isRecord(parsed) || !isJsonRpcMessage(parsed))
      return

    const message = parsed
    if (isJsonRpcResponse(message)) {
      const pending = this.#pending.get(message.id)
      if (!pending)
        return
      this.#pending.delete(message.id)
      if (message.error)
        pending.reject(new Error(`${pending.method} failed (${message.error.code}): ${message.error.message}`))
      else
        pending.resolve(message.result)
      return
    }

    if ('id' in message && 'method' in message) {
      const requestId = message.id
      if (typeof requestId !== 'number' && typeof requestId !== 'string')
        return
      this.#transport.write(JSON.stringify({
        id: requestId,
        error: {
          code: -32601,
          message: `AIRI does not handle the ${message.method} client request yet.`,
        },
      } satisfies JsonRpcResponse))
      return
    }

    for (const listener of this.#messageListeners)
      void listener(message)
  }

  #handleClose(error: Error): void {
    if (this.#closed)
      return
    this.#closed = true
    for (const pending of this.#pending.values())
      pending.reject(error)
    this.#pending.clear()
    for (const listener of this.#closeListeners)
      listener(error)
  }
}

function createProcessTransport(command: string): CodexLineTransport {
  const child: ChildProcessWithoutNullStreams = spawn(command, ['app-server', '--enable', 'realtime_conversation'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const lines = readline.createInterface({ input: child.stdout })
  const lineListeners = new Set<(line: string) => void>()
  const closeListeners = new Set<(error?: Error) => void>()
  let stderr = ''

  lines.on('line', line => lineListeners.forEach(listener => listener(line)))
  child.stderr.on('data', chunk => stderr += String(chunk))
  child.once('error', error => closeListeners.forEach(listener => listener(error)))
  child.once('exit', (code, signal) => {
    if (code === 0) {
      closeListeners.forEach(listener => listener())
      return
    }
    const detail = stderr.trim()
    closeListeners.forEach(listener => listener(new Error(`Codex app-server exited with code ${code ?? 'null'} and signal ${signal ?? 'none'}${detail ? `: ${detail}` : ''}`)))
  })

  return {
    write(line) {
      child.stdin.write(`${line}\n`)
    },
    onLine(listener) {
      lineListeners.add(listener)
      return () => lineListeners.delete(listener)
    },
    onClose(listener) {
      closeListeners.add(listener)
      return () => closeListeners.delete(listener)
    },
    async close() {
      lines.close()
      child.stdin.end()
      if (child.exitCode == null)
        child.kill()
    },
  }
}

function defaultIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

function resolveDesktopCodexCommand(configuredCommand?: string): string {
  if (configuredCommand?.trim())
    return configuredCommand.trim()
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA)
    return 'codex'

  const binRoot = join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin')
  try {
    const candidates = readdirSync(binRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap((entry) => {
        const path = join(binRoot, entry.name, 'codex.exe')
        try {
          const modifiedAt = statSync(path).mtimeMs
          return statSync(path).isFile() ? [{ modifiedAt, path }] : []
        }
        catch {
          return []
        }
      })
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
    return candidates[0]?.path ?? 'codex'
  }
  catch {
    return 'codex'
  }
}

/**
 * Creates the Codex runtime that owns one app-server process.
 *
 * The manager keeps thread and turn state in the Electron main process. A
 * renderer can reload without taking process ownership from an active turn.
 */
export function createCodexBridgeManager(options: CodexBridgeManagerOptions): CodexBridgeManager {
  const isDirectory = options.isDirectory ?? defaultIsDirectory
  const workspace = options.workspace?.trim()
  const command = options.command?.trim() || 'codex'
  const threads = new Map<string, string>()
  const loadedThreads = new Set<string>()
  let client: JsonRpcClient | undefined
  let activeTurn: ActiveTurn | undefined
  let activeRealtime: ActiveRealtime | undefined
  let activeDesktopAudioMonitor: ActiveDesktopAudioMonitor | undefined
  let initializing: Promise<JsonRpcClient> | undefined

  const getStatus = (): CodexBridgeStatus => {
    if (!options.enabled)
      return { enabled: false, reason: 'Set AIRI_CODEX_BRAIN=1 to enable the Codex brain.' }
    if (!workspace)
      return { enabled: false, reason: 'Set AIRI_CODEX_WORKSPACE to an absolute project directory.' }
    if (!isAbsolute(workspace) || !isDirectory(workspace))
      return { enabled: false, reason: 'AIRI_CODEX_WORKSPACE must be an existing absolute project directory.' }
    return { enabled: true, workspace }
  }

  const startClient = async (): Promise<JsonRpcClient> => {
    const status = getStatus()
    if (!status.enabled)
      throw new Error(status.reason ?? 'The Codex brain is disabled.')
    if (client)
      return client
    if (initializing)
      return initializing

    initializing = (async () => {
      const transport = options.createTransport?.() ?? createProcessTransport(command)
      const nextClient = new JsonRpcClient(transport)
      nextClient.onClose(() => {
        if (client === nextClient)
          client = undefined
        loadedThreads.clear()
      })
      try {
        await nextClient.request('initialize', {
          clientInfo: {
            name: 'airi_codex_brain',
            title: 'AIRI Codex Brain',
            version: '0.1.0',
          },
          capabilities: {
            experimentalApi: true,
          },
        })
        nextClient.notify('initialized')
        client = nextClient
        return nextClient
      }
      catch (error) {
        await nextClient.close()
        throw error
      }
    })().finally(() => initializing = undefined)

    return initializing
  }

  const ensureThread = async (rpc: JsonRpcClient, conversationId: string): Promise<{ threadId: string, isNew: boolean }> => {
    const existing = threads.get(conversationId)
    if (existing && loadedThreads.has(existing))
      return { threadId: existing, isNew: false }

    if (existing) {
      const result = await rpc.request('thread/resume', {
        threadId: existing,
        cwd: workspace,
        approvalPolicy: 'never',
        sandbox: 'workspace-write',
      })
      const resumedThreadId = nestedString(result, 'thread', 'id')
      if (!resumedThreadId)
        throw new Error('thread/resume did not return a thread ID')
      threads.set(conversationId, resumedThreadId)
      loadedThreads.add(resumedThreadId)
      return { threadId: resumedThreadId, isNew: false }
    }

    const result = await rpc.request('thread/start', {
      cwd: workspace,
      approvalPolicy: 'never',
      sandbox: 'workspace-write',
      serviceName: 'airi_codex_brain',
    })
    const threadId = nestedString(result, 'thread', 'id')
    if (!threadId)
      throw new Error('thread/start did not return a thread ID')
    threads.set(conversationId, threadId)
    loadedThreads.add(threadId)
    return { threadId, isNew: true }
  }

  const interruptTurn = async (conversationId: string): Promise<void> => {
    if (!activeTurn || activeTurn.conversationId !== conversationId)
      return
    activeTurn.interruptRequested = true
    if (!activeTurn.threadId || !activeTurn.turnId || !client)
      return
    await client.request('turn/interrupt', {
      threadId: activeTurn.threadId,
      turnId: activeTurn.turnId,
    })
  }

  const stopRealtime = async (conversationId: string): Promise<void> => {
    if (!activeRealtime || activeRealtime.conversationId !== conversationId || !client)
      return
    const currentRealtime = activeRealtime
    await client.request('thread/realtime/stop', { threadId: currentRealtime.threadId })
    currentRealtime.finish()
  }

  const stopDesktopAudioMonitor = async (): Promise<void> => {
    const monitor = activeDesktopAudioMonitor
    if (!monitor)
      return

    activeDesktopAudioMonitor = undefined
    monitor.child.kill()
    monitor.finish()
  }

  /** Streams only Codex desktop's output volume, never the underlying audio or transcript. */
  const runDesktopAudioMonitor = async (
    onEvent: (event: CodexDesktopAudioEvent) => void | Promise<void>,
  ): Promise<void> => {
    if (process.platform !== 'win32') {
      await onEvent({ type: 'error', message: 'Codex desktop voice animation is currently available on Windows only.' })
      return
    }

    await stopDesktopAudioMonitor()
    const script = resolveCodexOutputMeterPath()
    if (!script) {
      await onEvent({ type: 'error', message: 'The Codex desktop audio meter is unavailable.' })
      return
    }

    await new Promise<void>((resolve) => {
      const child = spawn('powershell.exe', [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-ProcessName',
        'ChatGPT',
        '-IntervalMs',
        '50',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let settled = false
      let stderr = ''
      const finish = () => {
        if (settled)
          return
        settled = true
        if (activeDesktopAudioMonitor?.child === child)
          activeDesktopAudioMonitor = undefined
        resolve()
      }

      activeDesktopAudioMonitor = { child, finish }
      const output = readline.createInterface({ input: child.stdout })
      output.on('line', (line) => {
        const level = Number(line)
        if (!Number.isFinite(level))
          return
        void onEvent({ type: 'level', level: Math.min(1, Math.max(0, level)) })
      })
      child.stderr.on('data', chunk => stderr += String(chunk))
      child.on('error', async (error) => {
        await onEvent({ type: 'error', message: errorMessageFrom(error) ?? 'Could not start the Codex desktop audio meter.' })
        finish()
      })
      child.on('close', async (code) => {
        output.close()
        if (code && !settled) {
          await onEvent({ type: 'error', message: stderr.trim() || `Codex desktop audio meter exited with code ${code}.` })
        }
        finish()
      })
    })
  }

  const runRealtime = async (
    request: CodexRealtimeRequest,
    onEvent: (event: CodexRealtimeEvent) => void | Promise<void>,
  ): Promise<void> => {
    if (!request.sdp.startsWith('v=0'))
      throw new Error('Codex Voice requires a valid WebRTC SDP offer.')
    if (activeRealtime)
      await stopRealtime(activeRealtime.conversationId)

    const rpc = await startClient()
    const thread = await ensureThread(rpc, request.conversationId)
    const threadId = thread.threadId

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let stopMessages = () => {}
      let stopClose = () => {}
      const finish = (error?: Error) => {
        if (settled)
          return
        settled = true
        stopMessages()
        stopClose()
        if (activeRealtime?.conversationId === request.conversationId)
          activeRealtime = undefined
        if (error)
          reject(error)
        else
          resolve()
      }

      const handleMessage = async (message: JsonRpcMessage) => {
        const messageThreadId = eventThreadId(message)
        if (messageThreadId && messageThreadId !== threadId)
          return

        const event = mapRealtimeEvent(message)
        if (!event)
          return
        await onEvent(event)
        if (event.type === 'closed')
          finish()
        else if (event.type === 'error')
          finish(new Error(event.message))
      }

      stopMessages = rpc.onMessage((message) => {
        void handleMessage(message).catch((error: unknown) => {
          finish(new Error(errorMessageFrom(error) ?? 'Failed to handle a Codex Voice event.'))
        })
      })
      stopClose = rpc.onClose(error => finish(error))
      activeRealtime = { conversationId: request.conversationId, threadId, finish }

      const params: Record<string, unknown> = {
        threadId,
        outputModality: 'audio',
        version: 'v3',
        includeStartupContext: true,
        clientManagedHandoffs: false,
        flushTranscriptTailOnSessionEnd: false,
        codexResponsesAsItems: false,
        codexResponseHandoffMode: 'commentary',
        transport: { type: 'webrtc', sdp: request.sdp },
      }
      if (request.voice)
        params.voice = request.voice

      void rpc.request('thread/realtime/start', params).catch((error: unknown) => {
        finish(new Error(errorMessageFrom(error) ?? 'Failed to start Codex Voice.'))
      })
    })
  }

  const runTurn = async (
    request: CodexTurnRequest,
    onEvent: (event: CodexBridgeEvent) => void | Promise<void>,
  ): Promise<void> => {
    if (activeTurn)
      throw new Error('The Codex bridge already owns an active turn.')
    if (!request.text.trim())
      throw new Error('The Codex turn text is empty.')

    const turn: ActiveTurn = {
      conversationId: request.conversationId,
      interruptRequested: false,
    }
    let turnText = request.text
    activeTurn = turn

    let rpc: JsonRpcClient
    let threadId: string
    try {
      rpc = await startClient()
      const thread = await ensureThread(rpc, request.conversationId)
      threadId = thread.threadId
      turn.threadId = threadId

      if (thread.isNew && request.instructions?.trim())
        turnText = `${request.instructions.trim()}\n\n${request.text}`
    }
    catch (error) {
      if (activeTurn === turn)
        activeTurn = undefined
      throw error
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let stopMessages = () => {}
      let stopClose = () => {}
      const finish = (error?: Error) => {
        if (settled)
          return
        settled = true
        stopMessages()
        stopClose()
        if (activeTurn === turn)
          activeTurn = undefined
        if (error)
          reject(error)
        else
          resolve()
      }

      const handleMessage = async (message: JsonRpcMessage) => {
        const messageThreadId = eventThreadId(message)
        if (messageThreadId && messageThreadId !== threadId)
          return
        const messageTurnId = eventTurnId(message)
        if (turn.turnId && messageTurnId && messageTurnId !== turn.turnId)
          return

        const mapped = mapBridgeEvent(message)
        if (mapped)
          await onEvent(mapped)

        if (!('method' in message) || message.method !== 'turn/completed' || !isRecord(message.params) || !isRecord(message.params.turn))
          return
        const completedTurnId = stringField(message.params.turn, 'id') ?? turn.turnId
        const status = stringField(message.params.turn, 'status')
        if (!completedTurnId)
          return finish(new Error('turn/completed did not include a turn ID'))
        if (status === 'failed')
          return finish(turnFailure(message) ?? new Error('Codex turn failed'))
        if (status !== 'completed' && status !== 'interrupted')
          return
        await onEvent({ type: 'finish', threadId, turnId: completedTurnId, status })
        finish()
      }
      stopMessages = rpc.onMessage((message) => {
        void handleMessage(message).catch((error: unknown) => {
          finish(new Error(errorMessageFrom(error) ?? 'Failed to handle a Codex stream event.'))
        })
      })
      stopClose = rpc.onClose(error => finish(error))

      void rpc.request('turn/start', {
        threadId,
        input: [{ type: 'text', text: turnText }],
        cwd: workspace,
        approvalPolicy: 'never',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: [workspace],
          networkAccess: false,
        },
      }).then(async (result) => {
        const turnId = nestedString(result, 'turn', 'id')
        if (!turnId)
          throw new Error('turn/start did not return a turn ID')
        turn.turnId = turnId
        if (turn.interruptRequested)
          await interruptTurn(request.conversationId)
      }).catch((error: unknown) => {
        finish(new Error(errorMessageFrom(error) ?? 'Failed to start the Codex turn.'))
      })
    })
  }

  const stop = async (): Promise<void> => {
    await stopDesktopAudioMonitor()
    const current = client
    client = undefined
    activeTurn = undefined
    loadedThreads.clear()
    if (current)
      await current.close()
  }

  return {
    getStatus,
    runTurn,
    runRealtime,
    runDesktopAudioMonitor,
    interruptTurn,
    stopRealtime,
    stopDesktopAudioMonitor,
    stop,
  }
}

/** Creates the desktop Codex manager from process environment settings. */
export function createDesktopCodexBridgeManager(): CodexBridgeManager {
  const manager = createCodexBridgeManager({
    enabled: process.env.AIRI_CODEX_BRAIN === '1',
    workspace: process.env.AIRI_CODEX_WORKSPACE,
    command: resolveDesktopCodexCommand(process.env.AIRI_CODEX_COMMAND),
  })
  onAppBeforeQuit(() => manager.stop())
  return manager
}
