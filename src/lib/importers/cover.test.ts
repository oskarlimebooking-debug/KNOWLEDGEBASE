import { describe, expect, it } from 'vitest';
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  canGenerateCanvasCover,
  emojiFromKeyword,
  generateTextCover,
  wrapTitle,
} from './cover';
import { asDocument, makeDoc } from '../../test/dom-stub';

describe('emojiFromKeyword', () => {
  it('maps science-y titles to 🔬', () => {
    expect(emojiFromKeyword('Cosmos: a brief science history')).toBe('🔬');
  });

  it('maps fiction titles to 📖', () => {
    expect(emojiFromKeyword('A Quiet Novel of the Mountains')).toBe('📖');
  });

  it('falls back to 📚 when nothing matches', () => {
    expect(emojiFromKeyword('Untitled')).toBe('📚');
  });

  it('matches case-insensitively', () => {
    expect(emojiFromKeyword('PHILOSOPHY of stoic life')).toBe('🧠');
  });
});

describe('wrapTitle', () => {
  it('keeps short titles on one line', () => {
    expect(wrapTitle('Short', 16)).toEqual(['Short']);
  });

  it('wraps at the next word boundary past the limit', () => {
    expect(wrapTitle('A very long title that wraps', 16)).toEqual([
      'A very long',
      'title that wraps',
    ]);
  });

  it('places a single overlong word on its own line', () => {
    expect(wrapTitle('Supercalifragilistic', 16)).toEqual(['Supercalifragilistic']);
  });
});

describe('canGenerateCanvasCover', () => {
  it('returns false when the document cannot make a 2d context', () => {
    const doc = makeDoc();
    expect(canGenerateCanvasCover(asDocument(doc))).toBe(false);
  });
});

describe('generateTextCover', () => {
  it('returns null when no canvas is available (test environment)', () => {
    const doc = makeDoc();
    expect(generateTextCover('Anything', asDocument(doc))).toBeNull();
  });
});

describe('constants', () => {
  it('exposes the documented 300x400 cover dimensions', () => {
    expect(COVER_WIDTH).toBe(300);
    expect(COVER_HEIGHT).toBe(400);
  });
});
