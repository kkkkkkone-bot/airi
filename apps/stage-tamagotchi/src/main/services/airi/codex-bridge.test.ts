import type { CodexBridgeEvent, CodexRealtimeEvent } from '../../../shared/codex-bridge'

import { describe, expect, it, vi } from 'vitest'

import { createCodexBridgeManager } from './codex-bridge'

interface RequestLine {
  id: number
  method: string
  params?: Record<string, unknown>
}

class FakeTransport {
  readonly requests: RequestLine[] = []
  readonly notifications: string[] = []
  readonly #lineListeners = new Set<(line: string) => void>()
  readonly #closeListeners = new Set<(error?: Error) => void>()
  onRequest?: (request: RequestLine) => void

  write(line: string) {
    const message = JSON.parse(line) as { id?: number, method: string, params?: Record<string, unknown> }
    if (message.id === undefined) {
      this.notifications.push(message.method)
      return
    }
    const request = { id: message.id, method: message.method, params: message.params }
    this.requests.push(request)
    this.onRequest?.(request)
  }

  onLine(listener: (line: string) => void) {
    this.#lineListeners.add(listener)
    return () => this.#lineListeners.delete(listener)
  }

  onClose(listener: (error?: Error) => void) {
    this.#closeListeners.add(listener)
    return () => this.#closeListeners.delete(listener)
  }

  async close() {
    this.emitClose()
  }

  respond(id: number, result: unknown) {
    this.emit({ id, result })
  }

  emit(message: unknown) {
    const line = JSON.stringify(message)
    this.#lineListeners.forEach(listener => listener(line))
  }

  emitClose(error?: Error) {
    this.#closeListeners.forEach(listener => listener(error))
  }
}

function createReadyTransport(threadId = 'thread-1', turnId = 'turn-1') {
  const transport = new FakeTransport()
  transport.onRequest = (request) => {
    if (request.method === 'initialize')
      transport.respond(request.id, {})
    if (request.method === 'thread/start')
      transport.respond(request.id, { thread: { id: threadId } })
    if (request.method === 'thread/resume')
      transport.respond(request.id, { thread: { id: threadId } })
    if (request.method === 'turn/start')
      transport.respond(request.id, { turn: { id: turnId } })
    if (request.method === 'thread/realtime/start')
      transport.respond(request.id, {})
    if (request.method === 'thread/realtime/stop')
      transport.respond(request.id, {})
  }
  return transport
}

describe('codex bridge manager', () => {
  it('stays disabled until an absolute workspace is configured', () => {
    const disabled = createCodexBridgeManager({ enabled: false })
    const missingWorkspace = createCodexBridgeManager({ enabled: true })
    const relativeWorkspace = createCodexBridgeManager({
      enabled: true,
      workspace: 'relative/path',
      isDirectory: () => true,
    })

    expect(disabled.getStatus()).toMatchObject({ enabled: false })
    expect(missingWorkspace.getStatus()).toMatchObject({ enabled: false })
    expect(relativeWorkspace.getStatus()).toMatchObject({ enabled: false })
  })

  it('streams one Codex turn and reuses its thread for the conversation', async () => {
    const transport = createReadyTransport()
    const manager = createCodexBridgeManager({
      enabled: true,
      workspace: 'C:\\project',
      isDirectory: () => true,
      createTransport: () => transport,
    })
    const events: CodexBridgeEvent[] = []

    const first = manager.runTurn({ conversationId: 'conversation-1', instructions: 'Be friendly.', text: 'hello' }, (event) => {
      events.push(event)
    })
    await vi.waitFor(() => expect(transport.requests.some(request => request.method === 'turn/start')).toBe(true))
    transport.emit({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', delta: 'Hi' } })
    transport.emit({ method: 'item/reasoning/summaryTextDelta', params: { threadId: 'thread-1', turnId: 'turn-1', delta: 'Think' } })
    transport.emit({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })
    await first

    const second = manager.runTurn({ conversationId: 'conversation-1', text: 'again' }, (event) => {
      events.push(event)
    })
    await vi.waitFor(() => expect(transport.requests.filter(request => request.method === 'turn/start')).toHaveLength(2))
    transport.emit({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })
    await second

    expect(transport.notifications).toContain('initialized')
    expect(transport.requests.filter(request => request.method === 'thread/start')).toHaveLength(1)
    expect(transport.requests.find(request => request.method === 'turn/start')?.params?.input).toEqual([
      { type: 'text', text: 'Be friendly.\n\nhello' },
    ])
    expect(transport.requests.find(request => request.method === 'thread/start')?.params?.sandbox).toBe('workspace-write')
    expect(transport.requests.find(request => request.method === 'turn/start')?.params?.sandboxPolicy).toEqual({
      type: 'workspaceWrite',
      writableRoots: ['C:\\project'],
      networkAccess: false,
    })
    expect(events).toEqual(expect.arrayContaining([
      { type: 'text-delta', text: 'Hi' },
      { type: 'reasoning-delta', text: 'Think' },
    ]))
  })

  it('resumes a known thread after the app-server restarts', async () => {
    const firstTransport = createReadyTransport()
    const secondTransport = createReadyTransport()
    const transports = [firstTransport, secondTransport]
    const manager = createCodexBridgeManager({
      enabled: true,
      workspace: 'C:\\project',
      isDirectory: () => true,
      createTransport: () => transports.shift()!,
    })

    const first = manager.runTurn({ conversationId: 'conversation-1', text: 'hello' }, () => {})
    await vi.waitFor(() => expect(firstTransport.requests.some(request => request.method === 'turn/start')).toBe(true))
    firstTransport.emit({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })
    await first
    firstTransport.emitClose()

    const second = manager.runTurn({ conversationId: 'conversation-1', text: 'again' }, () => {})
    await vi.waitFor(() => expect(secondTransport.requests.some(request => request.method === 'turn/start')).toBe(true))
    secondTransport.emit({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })
    await second

    expect(secondTransport.requests.filter(request => request.method === 'thread/resume')).toHaveLength(1)
    expect(secondTransport.requests.filter(request => request.method === 'thread/start')).toHaveLength(0)
  })

  it('interrupts the active turn for its conversation', async () => {
    const transport = createReadyTransport()
    transport.onRequest = (request) => {
      if (request.method === 'initialize')
        transport.respond(request.id, {})
      if (request.method === 'thread/start')
        transport.respond(request.id, { thread: { id: 'thread-1' } })
      if (request.method === 'turn/start')
        transport.respond(request.id, { turn: { id: 'turn-1' } })
      if (request.method === 'turn/interrupt') {
        transport.respond(request.id, {})
        queueMicrotask(() => transport.emit({
          method: 'turn/completed',
          params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'interrupted' } },
        }))
      }
    }
    const manager = createCodexBridgeManager({
      enabled: true,
      workspace: 'C:\\project',
      isDirectory: () => true,
      createTransport: () => transport,
    })

    const turn = manager.runTurn({ conversationId: 'conversation-1', text: 'wait' }, () => {})
    await vi.waitFor(() => expect(transport.requests.some(request => request.method === 'turn/start')).toBe(true))
    await manager.interruptTurn('conversation-1')
    await turn

    expect(transport.requests.find(request => request.method === 'turn/interrupt')?.params).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1',
    })
  })

  it('opens a native Codex Voice session and forwards its WebRTC events', async () => {
    const transport = createReadyTransport()
    const manager = createCodexBridgeManager({
      enabled: true,
      workspace: 'C:\\project',
      isDirectory: () => true,
      createTransport: () => transport,
    })
    const events: CodexRealtimeEvent[] = []

    const realtime = manager.runRealtime({
      conversationId: 'conversation-1',
      sdp: 'v=0\r\no=airi 1 1 IN IP4 127.0.0.1',
      voice: 'cove',
    }, (event) => {
      events.push(event)
    })
    await vi.waitFor(() => expect(transport.requests.some(request => request.method === 'thread/realtime/start')).toBe(true))

    const request = transport.requests.find(item => item.method === 'thread/realtime/start')
    expect(request?.params).toMatchObject({
      threadId: 'thread-1',
      outputModality: 'audio',
      version: 'v3',
      transport: {
        type: 'webrtc',
        sdp: 'v=0\r\no=airi 1 1 IN IP4 127.0.0.1',
      },
      voice: 'cove',
    })

    transport.emit({ method: 'thread/realtime/started', params: { threadId: 'thread-1', version: 'v3', realtimeSessionId: 'voice-1' } })
    transport.emit({ method: 'thread/realtime/sdp', params: { threadId: 'thread-1', sdp: 'v=0\r\no=codex 1 1 IN IP4 127.0.0.1' } })
    transport.emit({ method: 'thread/realtime/transcript/done', params: { threadId: 'thread-1', role: 'assistant', text: '你好，我在。' } })
    transport.emit({ method: 'thread/realtime/closed', params: { threadId: 'thread-1', reason: 'ended' } })
    await realtime

    expect(events).toEqual([
      { type: 'started', threadId: 'thread-1', realtimeSessionId: 'voice-1' },
      { type: 'sdp', sdp: 'v=0\r\no=codex 1 1 IN IP4 127.0.0.1' },
      { type: 'transcript-done', role: 'assistant', text: '你好，我在。' },
      { type: 'closed', reason: 'ended' },
    ])
  })

  it('rejects the turn when the AIRI stream consumer fails', async () => {
    const transport = createReadyTransport()
    const manager = createCodexBridgeManager({
      enabled: true,
      workspace: 'C:\\project',
      isDirectory: () => true,
      createTransport: () => transport,
    })

    const turn = manager.runTurn({ conversationId: 'conversation-1', text: 'hello' }, () => {
      throw new Error('renderer closed')
    })
    await vi.waitFor(() => expect(transport.requests.some(request => request.method === 'turn/start')).toBe(true))
    transport.emit({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', delta: 'Hi' } })

    await expect(turn).rejects.toThrow('renderer closed')
  })
})
