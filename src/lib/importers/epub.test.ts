import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseContainer, parseEpub, parseOpf, stripHtml } from './epub';

function buildEpubBuffer(opts: {
  title: string;
  author?: string;
  chapters: Array<{ filename: string; html: string }>;
  opfPath?: string;
}): Promise<ArrayBuffer> {
  const opfPath = opts.opfPath ?? 'OEBPS/content.opf';
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const manifest = opts.chapters
    .map((c, i) => `<item id="ch${i}" href="${c.filename}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spine = opts.chapters.map((_, i) => `<itemref idref="ch${i}"/>`).join('\n');
  const author = opts.author !== undefined ? `<dc:creator>${opts.author}</dc:creator>` : '';

  zip.file(
    opfPath,
    `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${opts.title}</dc:title>
    ${author}
    <dc:identifier id="bookid">urn:uuid:test</dc:identifier>
  </metadata>
  <manifest>${manifest}</manifest>
  <spine>${spine}</spine>
</package>`,
  );

  for (const c of opts.chapters) {
    zip.file(opfDir + c.filename, c.html);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('stripHtml', () => {
  it('strips tags and preserves paragraph boundaries', () => {
    const text = stripHtml('<p>Hello</p><p>World</p>');
    expect(text).toBe('Hello\n\nWorld');
  });

  it('converts <br> to single newline', () => {
    expect(stripHtml('a<br>b<br/>c')).toBe('a\nb\nc');
  });

  it('decodes numeric and common-named entities', () => {
    // Named entities supported: amp, lt, gt, quot, apos, nbsp.
    // Numeric (decimal and hex) entities are supported for everything else.
    expect(stripHtml('<p>caf&#233; &amp; cake</p>')).toBe('café & cake');
    expect(stripHtml('&#39;quoted&#39;')).toBe("'quoted'");
    expect(stripHtml('&#x41;')).toBe('A');
  });

  it('collapses excessive whitespace', () => {
    expect(stripHtml('<p>a    b  \n   c</p>')).toBe('a b c');
  });

  it('handles nested block tags', () => {
    expect(stripHtml('<div><h1>T</h1><p>p</p></div>')).toBe('T\n\np');
  });
});

describe('parseContainer', () => {
  it('extracts the OPF path', () => {
    const xml = '<rootfile full-path="OEBPS/x.opf" media-type="..."/>';
    expect(parseContainer(xml)).toBe('OEBPS/x.opf');
  });

  it('returns null when no rootfile element exists', () => {
    expect(parseContainer('<container/>')).toBeNull();
  });
});

describe('parseOpf', () => {
  it('extracts title, author, and spine paths', () => {
    const opf = `
<package>
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>My Book</dc:title>
    <dc:creator>Jane Doe</dc:creator>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml"/>
    <item id="ch2" href="ch2.xhtml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;
    const r = parseOpf(opf, 'OEBPS/content.opf');
    expect(r.title).toBe('My Book');
    expect(r.author).toBe('Jane Doe');
    expect(r.spinePaths).toEqual(['OEBPS/ch1.xhtml', 'OEBPS/ch2.xhtml']);
  });

  it('returns Untitled when title is missing', () => {
    const r = parseOpf('<package/>', 'content.opf');
    expect(r.title).toBe('Untitled');
    expect(r.author).toBeNull();
  });
});

describe('parseEpub (real ZIP)', () => {
  it('parses a 2-chapter EPUB', async () => {
    const buf = await buildEpubBuffer({
      title: 'Mini',
      author: 'Anon',
      chapters: [
        { filename: 'ch1.xhtml', html: '<html><body><p>One.</p></body></html>' },
        { filename: 'ch2.xhtml', html: '<html><body><p>Two.</p></body></html>' },
      ],
    });
    const r = await parseEpub(buf);
    expect(r.title).toBe('Mini');
    expect(r.author).toBe('Anon');
    expect(r.source).toBe('epub');
    expect(r.content).toContain('One.');
    expect(r.content).toContain('Two.');
  });

  it('handles a book with no author metadata', async () => {
    const buf = await buildEpubBuffer({
      title: 'Anonymous Work',
      chapters: [{ filename: 'ch1.xhtml', html: '<p>x</p>' }],
    });
    const r = await parseEpub(buf);
    expect(r.author).toBeNull();
  });

  it('throws on a ZIP that is not an EPUB', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'world');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(parseEpub(buf)).rejects.toThrow(/container/i);
  });

  it('skips spine items that point at missing files (lenient)', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      '<rootfiles><rootfile full-path="c.opf" media-type="x"/></rootfiles>',
    );
    zip.file(
      'c.opf',
      `<package><metadata xmlns:dc="x"><dc:title>T</dc:title></metadata>
       <manifest><item id="m" href="missing.xhtml"/></manifest>
       <spine><itemref idref="m"/></spine></package>`,
    );
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const r = await parseEpub(buf);
    expect(r.content).toBe('');
  });
});
