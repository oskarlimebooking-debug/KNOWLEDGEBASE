# 09 — Quiz Modes

The Quiz tab is actually a **hub** that fans out into six different
mini-games. Each game is a different way of testing the same chapter
content. All games share the cached `quiz_<chapterId>` row but transform
the data into mode-specific shapes.

## Hub (`showQuizHub`)

`index.html:14769`. Shows:

- Best score (across attempts)
- Total attempts
- 6 mode buttons:

| Mode | Function | Description |
|------|----------|-------------|
| ❓ Classic | `renderQuizQuestion` | Multiple choice + true/false + open-ended |
| ⚡ Speed Round | `startSpeedRound` | 10 rapid-fire MC, 15 s each |
| 📝 Fill in the Blanks | `startFillBlanks` | Sentences with key terms removed |
| 🎭 Devil's Advocate | `startDebateMode` | AI counter-arguments, defend your knowledge |
| 🔗 Connections | `startConnectionsMode` | Match concepts to definitions |
| 🎯 Who Am I? | `startWhoAmIMode` | Guess concept from progressively easier clues |

Plus:
- **Generate More Questions** — adds 5 more to the cached set.
- **Regenerate** — wipes the cache and starts fresh.

## Classic (`renderQuizQuestion`)

`index.html:14944`. Iterates the cached `questions` array. Each question
has `type` ∈ `multiple_choice | true_false | open_ended`.

- **Multiple choice**: 4 options, `correctIndex`, `explanation`.
- **True/false**: `correct: bool`, `explanation`.
- **Open-ended**: `sampleAnswer` shown after submission.

Selecting an option immediately reveals the answer + explanation. After
the last question, the score is saved via `saveQuizScore`.

Special features:
- Streak counter (consecutive correct answers).
- "Retake wrong only" button at the end.

## Speed Round (`startSpeedRound`)

`index.html:15157`. Selects 10 random multiple-choice questions, sets a
15-second timer per question. Fast UI:
- Big timer + visual progress bar.
- Selecting an option auto-advances after 1.5 s.
- Final score includes time-bonus.

## Fill in the Blanks (`startFillBlanks`)

`index.html:15308`. Sends a dedicated AI prompt asking it to extract 8
sentences from the chapter and replace key terms with `____`. JSON shape:

```json
{ "blanks": [ { "sentence": "The ____ rises in the east.",
               "answer": "sun",
               "hint": "It's a star" } ] }
```

User types into the blank, hits Check. Answers are matched with case-
insensitive trimmed equality (and a Levenshtein distance ≤ 2 for partial
credit).

## Devil's Advocate (`startDebateMode`)

`index.html:15436`. The most ambitious mode. Fires a prompt asking for 5
"challenges" — counter-arguments to ideas in the chapter. Each challenge
has:

```json
{ "topic": "Phrase the chapter argues for",
  "counter_argument": "A devil's advocate position",
  "model_defense": "How a knowledgeable defender would respond" }
```

UI:
- Shows the topic + counter-argument.
- User types their defense in a textarea.
- AI evaluates the defense against `model_defense` and gives feedback
  + score (`lhSubmitDebate`).

The `Reveal` button shows the model defense if the user is stuck.

## Connections (`startConnectionsMode`)

`index.html:15590`. AI generates 6 concept ↔ definition pairs:

```json
{ "pairs": [
  { "concept": "Photosynthesis",
    "match": "Process of converting light into chemical energy" }
]}
```

UI: two columns of buttons (concepts left, matches right shuffled).
Click a concept then a match — if they pair, both fade out. Track wrong
attempts.

## Who Am I? (`startWhoAmIMode`)

`index.html:15745`. AI generates 5 riddles where each `concept` has 4
clues from very abstract to very specific:

```json
{ "riddles": [
  { "answer": "Recursion",
    "clues": [
      "I refer to myself.",
      "Mathematicians use me to define factorial.",
      "I always need a base case to avoid running forever.",
      "fn(n) = n * fn(n-1)"
    ]
}]}
```

The first clue is shown; the user can request more clues. Score formula:
`points = max(1, 5 - cluesUsed)`. Wrong guesses cost 1 point each.

## Score persistence

`saveQuizScore(chapterId, correct, total)` (`index.html:14842`) writes:

```js
{
  id: `quiz_scores_${chapterId}`,
  type: 'quiz_scores',
  data: [
    { percentage, correct, total, date: ISO }
  ]
}
```

`getQuizBestScore` returns max % across attempts. `getQuizAttempts` returns
the count.

## "Generate More Questions" path

`generateMoreQuestions()` (`index.html:14853`). Sends a prompt that
includes the existing questions and explicitly asks for 5 NEW different
ones, parses the JSON, **appends** to the existing
`generated.data.questions` array, writes back. The hub re-renders with the
larger pool.

## Learning Hub (cross-chapter games)

`openBookLearningHub` (`index.html:15915`) opens a separate full-screen
view with 6 book-level games:

| Game | Function |
|------|----------|
| Cross-chapter quiz | `startLHCrossChapterQuiz` — 10 questions sampling from all chapters |
| Weak-spot quiz | `startLHWeakSpotQuiz` — focuses on chapters with low quiz scores |
| Book debate | `startLHBookDebate` — Devil's Advocate over the whole book |
| Timeline challenge | `startLHTimelineChallenge` — drag and drop events into chronological order |
| Explain simply | `startLHExplainSimply` — explain a concept at 5/10/15-year-old level |
| Scenario sim | `startLHScenarioSim` — pick how the book's principles apply to a scenario |

The Learning Hub uses its own dedicated DB cache key per game.

## Prompts and customization

Most quiz modes call AI with the user's customizable `quiz` prompt or a
dedicated mode-specific prompt embedded inline. The `quiz` prompt is in
`DEFAULT_PROMPTS` and can be overridden in Settings → Prompts.

Continue to [`10-feed-system.md`](10-feed-system.md).
