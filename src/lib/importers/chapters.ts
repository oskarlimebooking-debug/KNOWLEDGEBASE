// Chapter splitter — plain word-count strategy.
//
// Splits a long text into roughly equal-sized chapters at paragraph
// boundaries. The exact target words/chapter is configurable; the
// splitter prefers to overshoot a boundary rather than cut a paragraph
// mid-sentence. Empty input yields a single empty chapter (so importers
// always get a non-zero chapter count for the UI to display).

export const DEFAULT_WORDS_PER_CHAPTER = 2000;

export interface ChapterSlice {
  index: number;
  title: string;
  content: string;
}

function countWords(s: string): number {
  if (s.trim() === '') return 0;
  return s.trim().split(/\s+/).length;
}

export function splitIntoChapters(
  text: string,
  wordsPerChapter: number = DEFAULT_WORDS_PER_CHAPTER,
): ChapterSlice[] {
  if (wordsPerChapter < 100) {
    throw new Error('wordsPerChapter must be at least 100');
  }
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return [{ index: 0, title: 'Chapter 1', content: '' }];
  }

  const chapters: ChapterSlice[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;

  const flush = (): void => {
    const content = buffer.join('\n\n');
    chapters.push({
      index: chapters.length,
      title: `Chapter ${chapters.length + 1}`,
      content,
    });
    buffer = [];
    bufferWords = 0;
  };

  for (const para of paragraphs) {
    buffer.push(para);
    bufferWords += countWords(para);
    if (bufferWords >= wordsPerChapter) flush();
  }

  if (buffer.length > 0) flush();
  return chapters;
}
