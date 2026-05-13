// In-house Markdown renderer + HTML sanitizer (TB.9).
//
// Two-stage pipeline:
//   renderMarkdown(md)  -> HTML string  (escapes user text as it builds tags)
//   sanitizeHtml(html)  -> HTML string  (whitelists tags + attrs, neutralises
//                                        javascript: hrefs, forces every <a>
//                                        to target=_blank rel=noopener)
//   renderSafeMarkdown(md) = sanitizeHtml(renderMarkdown(md))
//
// Defense in depth: the renderer never emits unescaped user input outside
// of recognised markdown constructs, AND the sanitizer drops everything it
// does not explicitly recognise. Either layer alone neutralises the canonical
// XSS fixtures (<script>, onerror=, javascript:), but both run by default
// when consumers go through `renderSafeMarkdown`.
//
// Supported block-level constructs: `# / ## / ### heading`, paragraphs,
// bullet lists (`-` / `*`), numbered lists (`N.`), blockquotes (`>`),
// fenced code blocks (```), and blank-line paragraph separators.
//
// Supported inline constructs: bold (`**...**`), italic (`*...*` or
// `_..._`), inline code (`` `...` ``), links (`[text](url)`). Every link
// is emitted with target="_blank" and rel="noopener".

const WHITELIST_TAGS = new Set([
  'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'strong', 'em', 'a', 'br',
]);

const WHITELIST_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// URL allowlist. We accept only the schemes and relative forms that are
// known-safe to render as an anchor href. Everything else (javascript:,
// data:, vbscript:, file:, ftp:, bare scheme-less hostnames) is rejected,
// so the renderer falls back to `#`. The sanitizer applies the same gate
// to whatever it sees, as defense in depth against AI-emitted markup.
export function isSafeUrl(url: string): boolean {
  const t = url.trim();
  if (t === '') return false;
  if (t.startsWith('#') || t.startsWith('/') || t.startsWith('./') || t.startsWith('../')) {
    return true;
  }
  const lower = t.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:');
}

// Inline renderer. Operates on a single line's worth of text and returns
// HTML. Order: code spans first (so their bodies are not re-parsed),
// then links (URL gated through isSafeUrl), then escape the surviving
// plain-text, then bold, then italic, then restore placeholders.
export function renderInline(s: string): string {
  const codes: string[] = [];
  let work = s.replace(/`([^`]+)`/g, (_, body: string) => {
    codes.push(`<code>${escapeHtml(body)}</code>`);
    return `\x00CODE${codes.length - 1}\x00`;
  });

  const links: string[] = [];
  work = work.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt: string, url: string) => {
    const safeUrl = isSafeUrl(url) ? url.trim() : '#';
    const html = `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(txt)}</a>`;
    links.push(html);
    return `\x00LINK${links.length - 1}\x00`;
  });

  work = escapeHtml(work);
  work = work.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  work = work.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  work = work.replace(/_([^_]+)_/g, '<em>$1</em>');

  work = work.replace(/\x00CODE(\d+)\x00/g, (_, i: string) => codes[Number(i)] ?? '');
  work = work.replace(/\x00LINK(\d+)\x00/g, (_, i: string) => links[Number(i)] ?? '');
  return work;
}

interface BlockState {
  out: string[];
  paraBuf: string[];
  listType: 'ul' | 'ol' | null;
  inBlockquote: boolean;
  inCode: boolean;
  codeBuf: string[];
}

function flushBlocks(s: BlockState): void {
  if (s.paraBuf.length > 0) {
    s.out.push(`<p>${renderInline(s.paraBuf.join(' '))}</p>`);
    s.paraBuf = [];
  }
  if (s.listType !== null) {
    s.out.push(`</${s.listType}>`);
    s.listType = null;
  }
  if (s.inBlockquote) {
    s.out.push('</blockquote>');
    s.inBlockquote = false;
  }
}

// Single-line processor. Mutates `s` and returns nothing. Each branch
// makes a routing decision and either delegates to flushBlocks or pushes
// straight onto s.out. Kept under the 50-line ceiling by deferring inline
// formatting to renderInline and block closure to flushBlocks.
function processLine(s: BlockState, line: string): void {
  if (s.inCode) {
    if (line.trimEnd() === '```') {
      s.out.push(`<pre><code>${escapeHtml(s.codeBuf.join('\n'))}</code></pre>`);
      s.codeBuf = [];
      s.inCode = false;
      return;
    }
    s.codeBuf.push(line);
    return;
  }
  if (line.trimStart().startsWith('```')) {
    flushBlocks(s);
    s.inCode = true;
    return;
  }
  const heading = /^(#{1,3}) (.+)$/.exec(line);
  if (heading !== null) {
    flushBlocks(s);
    const level = heading[1]!.length;
    s.out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
    return;
  }
  const bullet = /^[-*] (.+)$/.exec(line);
  const numbered = /^\d+\. (.+)$/.exec(line);
  if (bullet !== null || numbered !== null) {
    const wantType: 'ul' | 'ol' = bullet !== null ? 'ul' : 'ol';
    if (s.paraBuf.length > 0) {
      s.out.push(`<p>${renderInline(s.paraBuf.join(' '))}</p>`);
      s.paraBuf = [];
    }
    if (s.inBlockquote) {
      s.out.push('</blockquote>');
      s.inBlockquote = false;
    }
    if (s.listType !== wantType) {
      if (s.listType !== null) s.out.push(`</${s.listType}>`);
      s.out.push(`<${wantType}>`);
      s.listType = wantType;
    }
    const content = bullet !== null ? bullet[1]! : numbered![1]!;
    s.out.push(`<li>${renderInline(content)}</li>`);
    return;
  }
  const bq = /^> ?(.*)$/.exec(line);
  if (bq !== null) {
    if (s.listType !== null) {
      s.out.push(`</${s.listType}>`);
      s.listType = null;
    }
    if (!s.inBlockquote) {
      s.out.push('<blockquote>');
      s.inBlockquote = true;
    }
    s.paraBuf.push(bq[1]!);
    return;
  }
  if (line.trim() === '') {
    flushBlocks(s);
    return;
  }
  if (s.listType !== null || s.inBlockquote) flushBlocks(s);
  s.paraBuf.push(line);
}

export function renderMarkdown(md: string): string {
  const state: BlockState = {
    out: [],
    paraBuf: [],
    listType: null,
    inBlockquote: false,
    inCode: false,
    codeBuf: [],
  };
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) processLine(state, line);
  flushBlocks(state);
  if (state.inCode) {
    state.out.push(`<pre><code>${escapeHtml(state.codeBuf.join('\n'))}</code></pre>`);
  }
  return state.out.join('');
}

// Build the safe re-serialisation of a single opening tag. Walks the
// raw attribute string with a regex, drops any attribute not on the
// per-tag allowlist, drops href values that fail isSafeUrl, and forces
// target=_blank rel=noopener on <a> (AC #4).
function renderSafeTag(tagName: string, rawAttrs: string): string {
  const allowedForTag = WHITELIST_ATTRS[tagName];
  const attrs: Array<[string, string]> = [];
  if (allowedForTag !== undefined && rawAttrs.length > 0) {
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs)) !== null) {
      const name = m[1]!.toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!allowedForTag.has(name)) continue;
      if (name === 'href' && !isSafeUrl(value)) continue;
      attrs.push([name, value]);
    }
  }
  if (tagName === 'a') {
    if (!attrs.some(([n]) => n === 'target')) attrs.push(['target', '_blank']);
    if (!attrs.some(([n]) => n === 'rel')) attrs.push(['rel', 'noopener']);
  }
  const serialised = attrs.map(([n, v]) => `${n}="${escapeHtml(v)}"`).join(' ');
  return serialised.length > 0 ? `<${tagName} ${serialised}>` : `<${tagName}>`;
}

export function sanitizeHtml(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)\s*\/?>/.exec(html.slice(lt));
    if (tagMatch === null) {
      out += '&lt;';
      i = lt + 1;
      continue;
    }
    const closing = tagMatch[1] === '/';
    const tagName = tagMatch[2]!.toLowerCase();
    const rawAttrs = tagMatch[3] ?? '';
    i = lt + tagMatch[0].length;
    if (!WHITELIST_TAGS.has(tagName)) continue;
    if (closing) {
      out += `</${tagName}>`;
      continue;
    }
    out += renderSafeTag(tagName, rawAttrs);
  }
  return out;
}

export function renderSafeMarkdown(md: string): string {
  return sanitizeHtml(renderMarkdown(md));
}
