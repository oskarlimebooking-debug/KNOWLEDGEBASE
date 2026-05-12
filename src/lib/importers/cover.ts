// Cover thumbnail generator.
//
// Produces a 300×400 JPEG data URL. Two code paths:
//   - generateTextCover(title): canvas-rendered placeholder with the
//     book's title centered on an accent background. Used as the EPUB
//     fallback (no embedded cover yet — Phase G adds extraction).
//   - For very large PDFs (> 5 MB) the importer skips cover generation
//     entirely; callers receive `null` and the UI shows the same
//     emoji-from-keyword placeholder used elsewhere.
//
// Canvas access requires a real DOM; tests cover the pure-function
// `emojiFromKeyword` and verify that `generateTextCover` short-circuits
// gracefully when no canvas is available (e.g. in Node tests).

export const COVER_WIDTH = 300;
export const COVER_HEIGHT = 400;

const KEYWORD_EMOJI: ReadonlyArray<[RegExp, string]> = [
  [/\b(science|physics|chemistry|biology|tech)\b/i, '🔬'],
  [/\b(history|war|empire|civilization)\b/i, '🏛️'],
  [/\b(fiction|novel|story|tale)\b/i, '📖'],
  [/\b(poetry|poem|verse)\b/i, '🪶'],
  [/\b(philosophy|ethics|stoic)\b/i, '🧠'],
  [/\b(business|economics|finance|market)\b/i, '📈'],
  [/\b(programming|code|software|developer)\b/i, '💻'],
  [/\b(cookbook|recipe|food|kitchen)\b/i, '🍳'],
  [/\b(travel|map|atlas|journey)\b/i, '🗺️'],
  [/\b(art|design|painting)\b/i, '🎨'],
];

export function emojiFromKeyword(text: string): string {
  for (const [re, emoji] of KEYWORD_EMOJI) {
    if (re.test(text)) return emoji;
  }
  return '📚';
}

export function canGenerateCanvasCover(doc: Document = document): boolean {
  if (typeof doc.createElement !== 'function') return false;
  const c = doc.createElement('canvas') as HTMLCanvasElement;
  if (typeof c.getContext !== 'function') return false;
  return c.getContext('2d') !== null;
}

export function generateTextCover(title: string, doc: Document = document): string | null {
  if (!canGenerateCanvasCover(doc)) return null;
  const canvas = doc.createElement('canvas') as HTMLCanvasElement;
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  // Background.
  ctx.fillStyle = '#16223d';
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 0, COVER_WIDTH, 4);

  // Title centered, wrapped at 16 chars.
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapTitle(title, 16);
  const lineHeight = 32;
  const totalHeight = lines.length * lineHeight;
  const startY = (COVER_HEIGHT - totalHeight) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i] as string, COVER_WIDTH / 2, startY + i * lineHeight);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

export function wrapTitle(title: string, maxLineLength: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length === 0) {
      line = w;
    } else if (line.length + 1 + w.length <= maxLineLength) {
      line += ' ' + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
