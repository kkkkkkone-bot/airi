---
goal: Add a Codex app-server brain path to the AIRI desktop app
version: 1.0
date_created: 2026-08-10
last_updated: 2026-08-10
owner: kkkkkkone-bot
status: 'Completed'
tags: [feature, codex, electron, agent]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

This plan adds an opt-in Codex brain path to the AIRI Electron app. The first slice keeps the existing provider path unchanged.

## 1. Requirements & Constraints

- **REQ-001**: The Electron main process must own the Codex app-server process.
- **REQ-002**: The renderer must receive text and reasoning deltas through Eventa.
- **REQ-003**: One AIRI conversation ID must map to one Codex thread ID.
- **REQ-004**: The provider brain path must keep its current behavior when the Codex path is disabled.
- **REQ-005**: The Codex path must use the current user message as the turn input.
- **SEC-001**: Each Codex turn must use a `workspaceWrite` sandbox with one explicit writable root.
- **SEC-002**: The Codex path must stay disabled unless `AIRI_CODEX_BRAIN=1` and `AIRI_CODEX_WORKSPACE` are valid.
- **CON-001**: The implementation must use the stable app-server stdio transport.
- **CON-002**: The implementation must not add a third-party runtime dependency.
- **GUD-001**: The main process must own the manager lifecycle and use Eventa for IPC.
- **PAT-001**: The stage-ui LLM store must expose one runtime stream override. The default stream must remain xsAI.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Add the app-server protocol runtime and its unit tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add shared Codex request, status, result, and event types in `apps/stage-tamagotchi/src/shared/codex-bridge.ts`. | Yes | 2026-08-10 |
| TASK-002 | Add Eventa definitions in `apps/stage-tamagotchi/src/shared/eventa/index.ts`. | Yes | 2026-08-10 |
| TASK-003 | Add the JSON-RPC client and Codex thread runtime in `apps/stage-tamagotchi/src/main/services/airi/codex-bridge.ts`. | Yes | 2026-08-10 |
| TASK-004 | Add protocol and lifecycle tests in `apps/stage-tamagotchi/src/main/services/airi/codex-bridge.test.ts`. | Yes | 2026-08-10 |

### Implementation Phase 2

- GOAL-002: Connect the main process to each AIRI chat renderer.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Add Eventa handlers in `apps/stage-tamagotchi/src/main/services/airi/codex-service.ts`. | Yes | 2026-08-10 |
| TASK-006 | Register one shared manager in `apps/stage-tamagotchi/src/main/index.ts`. | Yes | 2026-08-10 |
| TASK-007 | Register one process-wide Eventa service before renderer windows start. | Yes | 2026-08-10 |
| TASK-008 | Stop the shared manager during the existing app shutdown lifecycle. | Yes | 2026-08-10 |

### Implementation Phase 3

- GOAL-003: Route AIRI chat streams to Codex when the feature is enabled.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Add a typed stream override to `packages/stage-ui/src/stores/ai/chat-llm/llm.ts`. | Yes | 2026-08-10 |
| TASK-010 | Add store tests in `packages/stage-ui/src/stores/ai/chat-llm/llm.test.ts`. | Yes | 2026-08-10 |
| TASK-011 | Add the renderer adapter in `apps/stage-tamagotchi/src/renderer/bridges/codex-brain.ts`. | Yes | 2026-08-10 |
| TASK-012 | Initialize and dispose the adapter in `apps/stage-tamagotchi/src/renderer/App.vue`. | Yes | 2026-08-10 |

### Implementation Phase 4

- GOAL-004: Make the slice repeatable and ready for manual use.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Run the targeted Vitest files for the bridge and LLM store. | Yes | 2026-08-10 |
| TASK-014 | Run the stage-tamagotchi and stage-ui type checks. | Yes | 2026-08-10 |
| TASK-015 | Run targeted lint, protocol smoke testing, and inspect the final diff. | Yes | 2026-08-10 |
| TASK-016 | Update this plan status and task results after all checks pass. | Yes | 2026-08-10 |

## 3. Alternatives

- **ALT-001**: Replace the AIRI core-agent port now. This creates a large cross-platform change before the desktop path works.
- **ALT-002**: Connect the renderer to app-server WebSocket. The transport is experimental and gives process control to the renderer.
- **ALT-003**: Add a provider-compatible HTTP shim. This loses Codex thread, item, and tool lifecycle data.

## 4. Dependencies

- **DEP-001**: A local `codex app-server` command with valid Codex authentication.
- **DEP-002**: The existing `@moeru/eventa` Electron adapter.
- **DEP-003**: The existing AIRI chat orchestrator and LLM store.

## 5. Files

- **FILE-001**: `apps/stage-tamagotchi/src/shared/codex-bridge.ts` owns IPC data contracts.
- **FILE-002**: `apps/stage-tamagotchi/src/shared/eventa/index.ts` owns Eventa definitions.
- **FILE-003**: `apps/stage-tamagotchi/src/main/services/airi/codex-bridge.ts` owns the process and JSON-RPC lifecycle.
- **FILE-004**: `apps/stage-tamagotchi/src/main/services/airi/codex-service.ts` owns Eventa handlers.
- **FILE-005**: `apps/stage-tamagotchi/src/main/index.ts` owns process-wide service registration.
- **FILE-006**: `packages/stage-ui/src/stores/ai/chat-llm/llm.ts` owns the stream override.
- **FILE-007**: `apps/stage-tamagotchi/src/renderer/bridges/codex-brain.ts` maps bridge events to AIRI stream events.
- **FILE-008**: `apps/stage-tamagotchi/src/renderer/App.vue` owns renderer bridge setup and disposal.

## 6. Testing

- **TEST-001**: The JSON-RPC client must correlate responses and reject server errors.
- **TEST-002**: The bridge must start, resume, and reuse Codex threads by conversation ID.
- **TEST-003**: The bridge must map agent and reasoning deltas without mixing tool output into speech text.
- **TEST-004**: The LLM store must use xsAI by default and the override when one is registered.
- **TEST-005**: A turn from another thread must not enter the active AIRI stream.

## 7. Risks & Assumptions

- **RISK-001**: A packaged Windows app can fail to execute a Store-installed `codex.exe` because of file permissions.
- **RISK-002**: An app-server protocol change can break manual TypeScript contracts.
- **RISK-003**: Multiple AIRI windows can receive duplicate events if Eventa context ownership is incorrect.
- **ASSUMPTION-001**: AIRI can find a standalone Codex CLI or the Windows Codex Desktop CLI.
- **ASSUMPTION-002**: The first slice can use environment configuration before a settings page exists.

## 8. Related Specifications / Further Reading

[Codex app-server documentation](https://developers.openai.com/codex/app-server)

[AIRI repository guide](../AGENTS.md)
