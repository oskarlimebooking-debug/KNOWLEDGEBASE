# 10 — Feed System

The Feed is one of the most distinctive features of the merged Headway.
It turns a chapter, book, article, or entire project into a Twitter/X-
like timeline of ~20 posts authored by 12 different fictional
personalities — a fusion of Headway's original 7-personality cast and
ThesisCraft's 5-personality cast.

---

## 12 personalities (post-merger)

| Code | Origin | Voice | Sample username |
|---|---|---|---|
| `professor` | Headway | Academic, citation-heavy, corrects misconceptions pedantically | Dr.Actually, Prof_Citations, AcademicAlan, PhD_Thoughts |
| `researcher` | ThesisCraft | Data-driven, empirical findings, methods-focused | DataDriven, EvidenceFirst, Empirical_E |
| `hype` | Headway | CAPS LOCK, motivational, "this changed EVERYTHING 🔥🔥🔥" | GrindsetGuru, LevelUpLarry, 10X_Learner |
| `contrarian` | Headway | "Unpopular opinion but…", challenges conventional wisdom | WellActually, DevilsAdvocate, HotTakeHenry |
| `critic` | ThesisCraft | Challenges assumptions, names limitations, debates rigorously | TheSkeptic, MethodCritic, LimitsLoom |
| `unhinged` | Headway | Lowercase, chaotic, Gen-Z, absurdist analogies | chaotic_learner, brainrot_edu, unhinged_phd |
| `nurturing` | Headway | Warm, patient, "Let me break this down, friend…" | GentleGenius, LearnWithLove, KindMind |
| `storyteller` | Both | Opens with a hook, narrative payoff | TalesOfWisdom, StoryNerd, PlotTwistPaul |
| `meme` | Headway | Pop culture, self-deprecating, internet meme aesthetic | EducatedClown, BrainGooBrrr, MemePhD |
| `practitioner` | ThesisCraft | Applied, actionable, practice implications | InTheTrenches, AppliedAlex, RealWorldRox |
| `philosopher` | New | Conceptual, big-picture, "what does this *mean*…" | ZenScholar, DeeperWhy, AbstractAnna |
| `journalist` | New | Concise, headline-style, "Here's what you need to know" | NewsroomNico, TopOfFold, ScoopSarah |

The 12-personality cast is configurable per project via Settings:

```ts
settings.feedPersonalityRotation: {
  active: ('professor' | 'researcher' | 'hype' | 'contrarian' | 'critic' |
           'unhinged' | 'nurturing' | 'storyteller' | 'meme' | 'practitioner' |
           'philosopher' | 'journalist')[];
  perSourceKindOverride?: {
    book?: string[];
    article?: string[];
    url?: string[];
    note?: string[];
  };
}
```

Default mixes per source kind:

- `book` → 7 Headway core personalities (professor, hype, contrarian,
  unhinged, nurturing, storyteller, meme) — preserves pre-merger feel
- `article` → professor, researcher, critic, contrarian, practitioner,
  storyteller, philosopher (academic-leaning)
- `url` → journalist, hype, contrarian, meme, storyteller (news-leaning)
- `note` → nurturing, philosopher, storyteller (intimate)

---

## Post schema

```ts
interface FeedPost {
  id: number;
  username: string;
  handle: string;          // "@something"
  avatar: string;          // single emoji
  personality: PersonalityCode;

  content: string;         // post body, multi-paragraph for threads, includes #hashtags

  likes: number;           // 100 – 50000
  retweets: number;        // 10 – 5000
  views: number;           // 1000 – 500000
  isViral: boolean;        // 3-4 per batch

  hasImage: boolean;
  imagePrompt: string | null;   // detailed prompt for image generation

  hasLink: boolean;
  linkTopic: string | null;     // used to generate a deep-dive writeup

  // Cross-source feeds only
  sourceChapter?: string;  // e.g. "Chapter 4"
  sourceSources?: string[]; // e.g. ["Sapiens", "Homo Deus"]

  // ThesisCraft heritage (article feeds)
  conceptTag?: string;     // single concept tag for the post (article feeds)
  hasDeepDive?: boolean;   // legacy alias for hasLink (compat)
  deepDiveTopic?: string;  // legacy alias for linkTopic (compat)
}
```

Backward compat: TC's `conceptTag`, `hasDeepDive`, `deepDiveTopic` fields
are supported. They're aliased into the unified shape on read.

---

## Generators

### Per chapter (`generateFeed`)

Runs the customizable `feed` prompt on `chapter.content` +
`chapter.title`. Output cached as `feed_<chapterId>`.

### Per source (was per-book, `generateSourceFeedContent`)

Concatenates all chapters into one context (with chapter labels), runs
the `sourceFeed` prompt, demands diversity across chapters and "random
selection" rather than coverage. Cached as `source_feed_<sourceId>`.

For `kind: 'article'` and `kind: 'note'` sources (typically one chapter),
the source feed is essentially the chapter feed.

### Multi-source (was multi-book, `generateMultiSourceFeedContent`)

Sends multiple sources with their titles. Prompt explicitly asks for
cross-source CONNECTIONS, CONTRADICTIONS, SYNTHESES, PARALLELS. Cached
under a deterministic key built from sorted source IDs:
`multi_source_feed_<sortedJoinedIds>`.

### Cross-source (was cross-book, `generateCrossSourceFeedContent`)

One *source chapter* analyzed through the lens of one *target source*.
Used by "How does X relate to Y?" Useful for cross-disciplinary synthesis
and for a thesis project's literature review.

### Project feed (NEW — Phase L follow-up)

Aggregates the active project's recently-cited sources and recently-
edited sections. Generates posts that surface tensions and gaps in the
literature relative to the project's hypotheses. Cached as
`project_feed_<projectId>`.

---

## Prompt structure

The feed prompts mandate per-batch personality distribution. Default for
20 posts on a book chapter (7 active personalities):

```
Generate 20 posts. Distribute across personalities:
- Professor: 3-4 posts
- Hype: 2-3 posts
- Contrarian: 3-4 posts
- Unhinged: 2-3 posts
- Nurturing: 2-3 posts
- Storyteller: 2-3 posts
- Meme: 2-3 posts

Mark 3-4 posts as isViral with high engagement numbers.
Mark 3 posts with hasImage:true and a detailed imagePrompt.
Mark 5-6 posts with hasLink:true and a linkTopic.

Each post covers a DIFFERENT aspect/fact. NO repetition.
Vary lengths: some 1-2 sentences, some 5-10-sentence threads.
3-4 thread posts start with "🧵 Thread:".
Include 1-3 hashtags per post naturally.
```

For 20 posts on an article (academic-leaning, 7 active personalities):

```
- Professor: 3 posts
- Researcher: 3 posts
- Critic: 3 posts
- Contrarian: 2 posts
- Practitioner: 3 posts
- Storyteller: 3 posts
- Philosopher: 3 posts
```

---

## Render (`renderFeed`)

For each post:

- Twitter/X-style card UI: avatar, handle, content, action row (like,
  retweet, share, bookmark)
- `isViral: true` → adds a shimmer border and "Trending" pill
- `hasImage: true` → renders an inline image (lazy-loaded, generated on
  first view via `imagePrompt`, cached as a data URL in the post itself)
- `hasLink: true` → renders an inline link card; tap opens deep-dive
  writeup overlay (lazy-generated, cached per personality + topic)
- `#hashtags` are bolded in-place via a sanitized renderer (Phase G uses
  DOMPurify; pre-Phase-G uses a hand-written regex with whitelist)
- Mobile: vertical scroll. Desktop: card grid with infinite scroll.

### XSS safety

The hashtag renderer is the historical XSS vector. Both Headway and TC
used `dangerouslySetInnerHTML`. Phase G replaces this with React's
component-based hashtag tokenizer that emits `<strong>` tags via JSX (no
HTML injection possible).

---

## Image generation

When a post has `hasImage: true`, the renderer kicks off image generation
on first view (not at feed-generation time, to keep the initial response
cheap):

```ts
const cacheKey = `feed_image_${chapterId}_${postId}`;
let dataUrl = await dbGet('generated', cacheKey);
if (!dataUrl) {
  dataUrl = await callImageProvider({
    prompt: post.imagePrompt + perPersonalityStyleHint(post.personality),
    apiKey: settings.imageApiKey,
  });
  await dbPut('generated', { id: cacheKey, type: 'feed_image', data: dataUrl });
}
```

Per-personality style hints:

| Personality | Style hint |
|---|---|
| professor | "Clean academic infographic, blue/grey palette" |
| researcher | "Data visualization, charts, scientific paper aesthetic" |
| hype | "Bold neon poster, motivational gym vibes, 90s sticker" |
| contrarian | "Brutalist editorial illustration, harsh shadows" |
| critic | "Newspaper editorial cartoon, satirical line art" |
| unhinged | "Surreal collage, glitch art, vaporwave" |
| nurturing | "Soft watercolor, pastel, gentle hand-drawn" |
| storyteller | "Storybook illustration, warm fire-lit colors" |
| meme | "Internet meme template, bold Impact font feel" |
| practitioner | "Workshop poster, blueprint with annotations" |
| philosopher | "Minimalist black-and-white concept art" |
| journalist | "Newsroom photo journalism, B&W, headline overlay" |

---

## Deep-dive writeups

When a post has `hasLink: true`, tapping the inline link card triggers
`generateWriteup(linkTopic, personality)`:

- Cached as `writeup_<chapterId>_<linkTopic>_<personality>`
- 800–1500 words in the personality's voice
- Renders in a modal overlay with a glass-morphic backdrop
- Phase Q follow-up: writeups can include citations to library sources
  if they match the topic

---

## ThesisCraft heritage: card-style feed for articles

ThesisCraft's feed was designed for academic articles, not chapters. The
merged app supports both layouts:

- **Twitter timeline** (Headway default for books) — vertical cards in a
  dense feed
- **Story cards** (ThesisCraft default for articles) — full-screen
  swipeable cards (TikTok grammar), one personality per card with a
  larger image area

Toggle in Settings:
`settings.feedLayout: 'timeline' | 'cards'`. Default: `timeline` for
books, `cards` for articles. Per-source override available.

---

## Performance

- Generation: ~1 Gemini call per feed (20 posts in one JSON response)
- Per-image: 1 image API call (only on first view; cached)
- Per-writeup: 1 Gemini call (only on first tap; cached)

A complete feed with all images and 5 writeups consumed = ~26 paid calls.
Phase G's caching ensures none are repeated.

---

## "Generate more"

Click "Generate more" → appends 20 new posts to the cache. The prompt
includes the existing posts to avoid repetition: "Generate 20 NEW posts
that don't overlap with these: <existing IDs>".

"Regenerate" deletes the cache entry and starts fresh.

---

## Continue reading

- AI providers: [`16-ai-providers.md`](16-ai-providers.md)
- Image generation: [`15-image-generation.md`](15-image-generation.md)
- Source vs Book (per-kind feed defaults): [`32-source-vs-book.md`](32-source-vs-book.md)
- Cross-source feeds and project feeds: see Phase S in `implementation-plan/phase-s-cross-source-intelligence.md`
