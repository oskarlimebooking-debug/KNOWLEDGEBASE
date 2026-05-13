import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  isSafeUrl,
  renderInline,
  renderMarkdown,
  renderSafeMarkdown,
  sanitizeHtml,
} from './markdown';

describe('escapeHtml', () => {
  it('escapes <, >, &, and "', () => {
    expect(escapeHtml('a < b & c > d "e"')).toBe(
      'a &lt; b &amp; c &gt; d &quot;e&quot;',
    );
  });

  it('escapes ampersand before angle brackets', () => {
    // Order-of-replace regression: if `<` became `&lt;` first and then `&`
    // became `&amp;`, the previous escape would double-encode to `&amp;lt;`.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('&<')).toBe('&amp;&lt;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('isSafeUrl', () => {
  it('allows http / https / mailto schemes', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('https://example.com/path?q=1')).toBe(true);
    expect(isSafeUrl('mailto:foo@bar.com')).toBe(true);
  });

  it('allows relative URLs and fragments', () => {
    expect(isSafeUrl('/about')).toBe(true);
    expect(isSafeUrl('./local')).toBe(true);
    expect(isSafeUrl('../sibling')).toBe(true);
    expect(isSafeUrl('#anchor')).toBe(true);
  });

  it('rejects javascript:, data:, and vbscript: schemes regardless of case', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
  });

  it('rejects empty and bare schemes that are not in the allowlist', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('ftp://example.com')).toBe(false);
  });
});

describe('renderInline', () => {
  it('renders bold via **', () => {
    expect(renderInline('a **bold** word')).toBe('a <strong>bold</strong> word');
  });

  it('renders italic via *', () => {
    expect(renderInline('a *italic* word')).toBe('a <em>italic</em> word');
  });

  it('renders italic via underscores', () => {
    expect(renderInline('a _italic_ word')).toBe('a <em>italic</em> word');
  });

  it('renders inline code via backticks', () => {
    expect(renderInline('use `npm` here')).toBe('use <code>npm</code> here');
  });

  it('does not interpret markdown syntax inside a code span', () => {
    expect(renderInline('`*not bold*`')).toBe('<code>*not bold*</code>');
  });

  it('escapes HTML special chars inside code spans', () => {
    expect(renderInline('`<script>`')).toBe('<code>&lt;script&gt;</code>');
  });

  it('renders links with target=_blank and rel=noopener', () => {
    expect(renderInline('[click](https://x.com)')).toBe(
      '<a href="https://x.com" target="_blank" rel="noopener">click</a>',
    );
  });

  it('neutralises javascript: URLs at render time (defense in depth)', () => {
    expect(renderInline('[evil](javascript:alert)')).toBe(
      '<a href="#" target="_blank" rel="noopener">evil</a>',
    );
  });

  it('escapes inline HTML in plain text', () => {
    expect(renderInline('say <hi>')).toBe('say &lt;hi&gt;');
  });

  it('handles bold + italic + code combined', () => {
    expect(renderInline('**b** and *i* and `c`')).toBe(
      '<strong>b</strong> and <em>i</em> and <code>c</code>',
    );
  });

  it('returns empty string for empty input', () => {
    expect(renderInline('')).toBe('');
  });
});

describe('renderMarkdown — headings', () => {
  it('renders # as <h1>', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>');
  });

  it('renders ## as <h2>', () => {
    expect(renderMarkdown('## Subtitle')).toBe('<h2>Subtitle</h2>');
  });

  it('renders ### as <h3>', () => {
    expect(renderMarkdown('### Section')).toBe('<h3>Section</h3>');
  });

  it('does not render #### as a heading (only #/##/### supported)', () => {
    const out = renderMarkdown('#### Too deep');
    expect(out).not.toContain('<h4>');
    expect(out).toContain('Too deep');
  });

  it('applies inline formatting inside headings', () => {
    expect(renderMarkdown('# **Bold** title')).toBe('<h1><strong>Bold</strong> title</h1>');
  });
});

describe('renderMarkdown — emphasis', () => {
  it('renders bold and italic in a paragraph', () => {
    expect(renderMarkdown('This is **bold** and *italic*.')).toBe(
      '<p>This is <strong>bold</strong> and <em>italic</em>.</p>',
    );
  });
});

describe('renderMarkdown — lists', () => {
  it('renders a bullet list with - markers', () => {
    expect(renderMarkdown('- one\n- two\n- three')).toBe(
      '<ul><li>one</li><li>two</li><li>three</li></ul>',
    );
  });

  it('renders a bullet list with * markers', () => {
    expect(renderMarkdown('* one\n* two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders a numbered list', () => {
    expect(renderMarkdown('1. one\n2. two\n3. three')).toBe(
      '<ol><li>one</li><li>two</li><li>three</li></ol>',
    );
  });

  it('separates a bullet list from a following numbered list', () => {
    expect(renderMarkdown('- a\n- b\n1. one\n2. two')).toBe(
      '<ul><li>a</li><li>b</li></ul><ol><li>one</li><li>two</li></ol>',
    );
  });

  it('applies inline formatting inside list items', () => {
    expect(renderMarkdown('- **bold** item')).toBe(
      '<ul><li><strong>bold</strong> item</li></ul>',
    );
  });
});

describe('renderMarkdown — blockquotes', () => {
  it('renders a single-line blockquote', () => {
    expect(renderMarkdown('> a quote')).toBe('<blockquote><p>a quote</p></blockquote>');
  });

  it('joins consecutive blockquote lines into one paragraph', () => {
    expect(renderMarkdown('> line one\n> line two')).toBe(
      '<blockquote><p>line one line two</p></blockquote>',
    );
  });

  it('closes the blockquote on a blank line', () => {
    expect(renderMarkdown('> quote\n\nafter')).toBe(
      '<blockquote><p>quote</p></blockquote><p>after</p>',
    );
  });
});

describe('renderMarkdown — code', () => {
  it('renders inline code', () => {
    expect(renderMarkdown('use `cli` here')).toBe('<p>use <code>cli</code> here</p>');
  });

  it('renders a fenced code block', () => {
    expect(renderMarkdown('```\nconst x = 1;\n```')).toBe(
      '<pre><code>const x = 1;</code></pre>',
    );
  });

  it('preserves newlines inside a code block', () => {
    expect(renderMarkdown('```\nline1\nline2\n```')).toBe(
      '<pre><code>line1\nline2</code></pre>',
    );
  });

  it('escapes HTML inside a code block', () => {
    expect(renderMarkdown('```\n<script>alert(1)</script>\n```')).toBe(
      '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>',
    );
  });

  it('does not interpret markdown inside a code block', () => {
    // Even though the inner text has `# heading`, it must remain literal.
    const out = renderMarkdown('```\n# not a heading\n**not bold**\n```');
    expect(out).toBe('<pre><code># not a heading\n**not bold**</code></pre>');
  });

  it('flushes an unterminated code fence gracefully', () => {
    expect(renderMarkdown('```\nstill open')).toBe('<pre><code>still open</code></pre>');
  });
});

describe('renderMarkdown — links', () => {
  it('renders a link with target=_blank and rel=noopener', () => {
    expect(renderMarkdown('See [docs](https://docs.example.com).')).toBe(
      '<p>See <a href="https://docs.example.com" target="_blank" rel="noopener">docs</a>.</p>',
    );
  });

  it('forces every link to open in a new tab', () => {
    const out = renderMarkdown('[a](https://a.test) and [b](https://b.test)');
    const targets = (out.match(/target="_blank"/g) ?? []).length;
    const rels = (out.match(/rel="noopener"/g) ?? []).length;
    expect(targets).toBe(2);
    expect(rels).toBe(2);
  });
});

describe('renderMarkdown — paragraphs and mixed content', () => {
  it('wraps plain text in <p>', () => {
    expect(renderMarkdown('just a line')).toBe('<p>just a line</p>');
  });

  it('joins consecutive lines into one paragraph', () => {
    expect(renderMarkdown('line one\nline two')).toBe('<p>line one line two</p>');
  });

  it('separates paragraphs on blank lines', () => {
    expect(renderMarkdown('first\n\nsecond')).toBe('<p>first</p><p>second</p>');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('combines headings, lists, and paragraphs', () => {
    const md = '# Title\n\nIntro paragraph.\n\n- one\n- two\n\n## Next';
    expect(renderMarkdown(md)).toBe(
      '<h1>Title</h1><p>Intro paragraph.</p><ul><li>one</li><li>two</li></ul><h2>Next</h2>',
    );
  });
});

describe('sanitizeHtml — whitelist', () => {
  it('keeps whitelisted block tags', () => {
    expect(sanitizeHtml('<h1>Hi</h1><p>Body</p>')).toBe('<h1>Hi</h1><p>Body</p>');
  });

  it('keeps whitelisted inline tags', () => {
    expect(sanitizeHtml('<strong>b</strong> and <em>i</em> and <code>c</code>')).toBe(
      '<strong>b</strong> and <em>i</em> and <code>c</code>',
    );
  });

  it('strips disallowed tags but keeps their inner text', () => {
    expect(sanitizeHtml('<div>kept</div>')).toBe('kept');
  });

  it('strips disallowed attributes from allowed tags', () => {
    expect(sanitizeHtml('<p onclick="alert(1)">hi</p>')).toBe('<p>hi</p>');
  });
});

describe('sanitizeHtml — XSS fixtures', () => {
  it('neutralises <script> tags', () => {
    const out = sanitizeHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script>');
  });

  it('strips onerror handlers from disallowed tags', () => {
    const out = sanitizeHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
  });

  it('strips onerror handlers from allowed tags', () => {
    const out = sanitizeHtml('<p onerror="alert(1)">hi</p>');
    expect(out).toBe('<p>hi</p>');
    expect(out).not.toContain('onerror');
  });

  it('neutralises javascript: URLs on links', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
    // href dropped, but anchor structure + forced rel/target still present.
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener"');
  });

  it('drops onmouseover-style handlers entirely', () => {
    const out = sanitizeHtml('<a href="https://x.com" onmouseover="alert(1)">x</a>');
    expect(out).not.toContain('onmouseover');
    expect(out).toContain('href="https://x.com"');
  });
});

describe('sanitizeHtml — link attributes', () => {
  it('forces target=_blank and rel=noopener on anchors that lack them', () => {
    expect(sanitizeHtml('<a href="https://x.com">x</a>')).toBe(
      '<a href="https://x.com" target="_blank" rel="noopener">x</a>',
    );
  });

  it('preserves an existing rel value AND ensures noopener is present', () => {
    // Audit P2-1 hardening: tokenise existing rel + add noopener if missing,
    // so callers can't slip through with a non-conforming rel and force
    // target=_blank without noopener.
    const out = sanitizeHtml('<a href="https://x.com" rel="nofollow">x</a>');
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toContain('target="_blank"');
  });

  it('adds noopener when rel is empty (audit P2-1)', () => {
    const out = sanitizeHtml('<a href="https://x.com" rel="">x</a>');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
  });

  it('passes through anchor with safe href, target, and rel', () => {
    expect(
      sanitizeHtml('<a href="https://x.com" target="_blank" rel="noopener">x</a>'),
    ).toBe('<a href="https://x.com" target="_blank" rel="noopener">x</a>');
  });
});

describe('renderSafeMarkdown — combined pipeline', () => {
  it('renders + sanitises clean markdown unchanged', () => {
    expect(renderSafeMarkdown('# Title')).toBe('<h1>Title</h1>');
  });

  it('neutralises the canonical XSS fixture end-to-end', () => {
    const md = '<script>alert(1)</script> and ![x](x" onerror="alert(1)) and [evil](javascript:alert(1))';
    const out = renderSafeMarkdown(md);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('javascript:');
  });

  it('every link in the output opens in a new tab with noopener', () => {
    const md = '[a](https://a.test) and [b](https://b.test)';
    const out = renderSafeMarkdown(md);
    const anchors = out.match(/<a [^>]+>/g) ?? [];
    expect(anchors.length).toBe(2);
    for (const a of anchors) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener"');
    }
  });
});
