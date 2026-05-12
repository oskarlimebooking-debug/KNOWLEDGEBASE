---
id: TB.1
title: Gemini provider (callGeminiAPI)
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: done
sprint: '0'
depends_on: []
completed_at: '2026-05-12T19:25:08.418297'
---

# Gemini provider (callGeminiAPI)

`callGeminiAPI(prompt, apiKey, modelOverride, options)` POSTs to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`. 120s default timeout via AbortController. `options.jsonMode` sets `responseMimeType: 'application/json'`. `options.temperature`, `options.maxOutputTokens` overrides. Throws on non-2xx with the API's error message. `fetchAvailableModels(apiKey)` → list of `generateContent`-capable models with hard-coded fallback list. `getSelectedModel()` reads `selectedModel` (default `gemini-2.5-flash`).

# Acceptance Criteria

- [x] Unit tests cover happy path, timeout, 4xx, 5xx, malformed JSON response
- [x] AbortController cancels in-flight calls within 50ms
- [x] Hard-coded fallback model list is used when `fetchAvailableModels` errors
- [x] No PII leaked into error messages