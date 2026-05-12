---
id: TB.1
title: Anthropic provider (callAnthropic)
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: done
sprint: '0'
depends_on: []
completed_at: '2026-05-12T19:25:08.418297'
---

# Anthropic provider (callAnthropic)

`callAnthropic(prompt, apiKey, modelOverride, options)` calls the Anthropic Messages API via the official `@anthropic-ai/sdk`. 120s default timeout via AbortController (composable with caller-supplied `signal`). `options.jsonMode` instructs JSON-only output via the system prompt; `options.jsonSchema` upgrades that to strict `output_config.format` enforcement. `options.maxOutputTokens` overrides the 16k default. `options.thinking` defaults `true` (adaptive thinking per the /claude-api skill). `options.system` injects a system prompt. Throws on non-2xx with the API's error message; two-layer key redaction is preserved (regex sweep + literal-key substitution). `fetchAvailableModels(apiKey)` calls `client.models.list()` with hard-coded fallback. `getSelectedModel()` reads `selectedModel` (default `claude-opus-4-7`).

**Browser model**: SDK is initialised with `dangerouslyAllowBrowser: true`. The PWA is single-user — the user enters their own key in the settings modal and it is kept in memory only via `src/data/secrets.ts` (Sprint A audit P1-#2 lock: memory-only secrets). Do NOT carry this provider into a deployment where the key could be exfiltrated from someone else's device.

# Acceptance Criteria

- [x] Unit tests cover happy path, 4xx, 5xx, malformed JSON, model selection, JSON mode, adaptive thinking on/off
- [x] AbortController cancels in-flight calls within 50ms
- [x] Hard-coded fallback model list is used when `fetchAvailableModels` errors
- [x] No PII leaked into error messages (regex + literal-key redaction)
