# 20 — Settings

The Settings modal (`#settings-modal`) is opened with the gear icon. It
holds every configuration knob in the app. All settings live in the
`settings` IDB store as `{ key, value }` rows.

`openSettings()` calls `loadSettingsValues()` which reads every key and
populates the form. `saveSettings()` (`index.html:22677`) reads the form
and writes back via `setSetting(key, value)` for each.

## Sections (in render order)

### 1. Reading

| Key | Default | Description |
|-----|---------|-------------|
| `apiKey` | — | Google Gemini API key |
| `selectedModel` | `gemini-2.5-flash` | Default Gemini model id |
| `imageModel` | (auto) | Image-capable Gemini model |
| `imageProvider` | `gemini` | `gemini` or `bonkers` |
| `bonkersImageModel` | `bonkers-advance` | Bonkers model variant |
| `readingSpeed` | 200 | Words/minute (used to estimate reading time) |
| `ocrChunkSize` | 1000 | Words per chunk in sequential OCR cleaning |
| `feedPostCount` | 20 | Posts per feed generation |

### 2. AI Provider

| Key | Default | Values |
|-----|---------|--------|
| `aiProvider` | `gemini` | `gemini`, `merlin`, `junia`, `docanalyzer` |

The fields below appear conditionally based on `aiProvider`:

#### Merlin
| Key | Description |
|-----|-------------|
| `merlinEmail` | Login email |
| `merlinIdToken` / `merlinRefreshToken` / `merlinTokenExpiry` | Auth tokens |
| `merlinModel` | `gemini-3.0-flash` (or any Merlin-supported model) |
| `merlinWebAccess` | Boolean — enable web search inside Merlin |
| `merlinOCRMode` | `text` or `image` |

#### Junia
| Key | Description |
|-----|-------------|
| `juniaToken` | Bearer token |
| `juniaCreativity` | `Low` / `Medium` / `High` |
| `juniaPersona` | persona id (e.g. `ai-assistant`) |
| `juniaGpt4` | Boolean — use the GPT-4 mode |

#### DocAnalyzer
| Key | Description |
|-----|-------------|
| `docanalyzerApiKey` | API key |
| `docanalyzerModel` | `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4`, etc. |
| `docanalyzerAdherence` | `strict`, `balanced`, `creative` |

### 3. TTS

#### Lazybird
| Key | Default | Description |
|-----|---------|-------------|
| `useLazybirdTts` | false | Toggle |
| `lazybirdApiKey` | — | API key |
| `lazybirdVoice` | (first available) | Voice id |

A language filter UI helps narrow down the voice list.

#### Google Cloud TTS
| Key | Default | Description |
|-----|---------|-------------|
| `useGoogleTts` | false | Toggle |
| `googleTtsApiKey` | — | API key |
| `googleTtsVoice` | (default) | Voice name (e.g. `en-US-Wavenet-D`) |

The settings UI displays per-voice pricing using the
`GOOGLE_TTS_PRICING` lookup table (Standard $4 → Studio $160 / 1M chars).
A model filter and language filter narrow the voice list.

### 4. Vadoo (Video)

| Key | Default | Description |
|-----|---------|-------------|
| `vadooApiKey` | — | Vadoo API key |
| `vadooDuration` | `30-60` | seconds bucket |
| `vadooVoice` | `Onyx` | voice name |
| `vadooStyle` | `cinematic` | visual style |
| `vadooTheme` | `Hormozi_1` | caption theme |
| `vadooAspect` | `9:16` | aspect ratio |

A live "Credits remaining" badge shows the user's Vadoo balance once the
key is set.

### 5. Cloud Sync

OAuth flow: connect, disconnect. UI states: `connected`, `syncing`,
`error`, `disconnected`. Stored under:

| Key | Description |
|-----|-------------|
| `googleAccessToken` | Bearer token |
| `googleTokenExpiry` | ms timestamp |
| `lastSyncTime` | ISO of last successful sync |

Three buttons: **Sync Now**, **Upload to Cloud**, **Download from Cloud**.

### 6. Custom Prompts

Every default prompt is overridable. Settings stores them as
`prompt_<key>` rows. Keys:

```
prompt_chapterSplit
prompt_summary
prompt_quiz
prompt_flashcards
prompt_teachback
prompt_formatText
prompt_ocrClean
prompt_ttsClean
prompt_feed
prompt_bookFeed
prompt_multiBookFeed
prompt_writeup
prompt_bookWriteup
prompt_multiBookWriteup
prompt_mindmap
```

Each has a textarea + Reset-to-default button (`resetPrompt(key)`).

`getPrompt(key)` returns the custom value if set, else the default from
`DEFAULT_PROMPTS`.

### 7. Data Management

- **Export Data** (download all as JSON)
- **Import JSON File** (file picker)
- **Paste JSON** (textarea)
- **Clear TTS Cache** (wipes all `tts_cleaned_*` rows)
- **Check for Updates** (bump SW)
- **Force Update** (purge caches + unregister SW + reload)

## Per-chapter settings

Some keys are scoped to a chapter and not surfaced in the modal. They are
toggled inline in the Listen UI:

```
tts_clean_<provider>_<chapterId>
tts_describe_tables_<provider>_<chapterId>
tts_sequential_<provider>_<chapterId>
tts_model_<provider>_<chapterId>
liked_posts_<chapterId>
```

Plus PDF viewer state:

```
pdf_rotation_<bookId>_<page>
pdf_highlights_<bookId>_<page>
```

## Sync rules

A whitelist in `getSyncDataForUpload` decides which settings sync. Keys
NOT in the whitelist (e.g. per-chapter TTS toggles, PDF rotation/
highlights) stay local. The app could sync them but they're
device-context-specific and would conflict.

## Model dropdowns

`loadModelsIntoDropdown(selectId)` and `loadModelOptions(apiKey, selected)`
fetch live model lists. They cache per-session but re-fetch on settings
open. Click "Refresh Models" to force a re-fetch.

`refreshImageModels()` does the same for image-capable models.

## Reset behavior

There is no global "factory reset". Manual wipe via
`indexedDB.deleteDatabase('ChapterWiseDB')` from DevTools is the only
reset path. A rebuild should add a "Reset everything" button.

Continue to [`21-vercel-proxies.md`](21-vercel-proxies.md).
