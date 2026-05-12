// EPUB parser.
//
// EPUB is a ZIP that contains:
//   - META-INF/container.xml  → points at the OPF file
//   - <OPF>                   → metadata (title, author) + spine order
//   - HTML/XHTML files        → chapter content
//
// We parse the XML files with simple regex extractors rather than a
// real DOM parser so the importer runs in Node tests without a DOMParser
// shim. EPUB control files are well-formed enough for this to be
// reliable; if it isn't, we fall back to sensible defaults rather than
// throwing.

import JSZip from 'jszip';
import type { ParsedBookText } from './types';

interface OpfData {
  title: string;
  author: string | null;
  // Absolute paths (inside the ZIP) of every spine HTML/XHTML file, in
  // reading order.
  spinePaths: string[];
}

export async function parseEpub(file: Blob | ArrayBuffer): Promise<ParsedBookText> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const containerXml = await readZipFile(zip, 'META-INF/container.xml');
  if (containerXml === null) throw new Error('EPUB missing META-INF/container.xml');
  const opfPath = parseContainer(containerXml);
  if (opfPath === null) throw new Error('EPUB container.xml has no rootfile');

  const opfText = await readZipFile(zip, opfPath);
  if (opfText === null) throw new Error(`EPUB OPF not found at ${opfPath}`);
  const opf = parseOpf(opfText, opfPath);

  const fragments: string[] = [];
  for (const path of opf.spinePaths) {
    const html = await readZipFile(zip, path);
    if (html === null) continue;
    const text = stripHtml(html).trim();
    if (text !== '') fragments.push(text);
  }

  return {
    title: opf.title,
    author: opf.author,
    content: fragments.join('\n\n'),
    source: 'epub',
  };
}

async function readZipFile(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  if (f === null) return null;
  return f.async('string');
}

export function parseContainer(xml: string): string | null {
  const match = /<rootfile[^>]*full-path=["']([^"']+)["']/i.exec(xml);
  return match !== null ? (match[1] as string) : null;
}

export function parseOpf(xml: string, opfPath: string): OpfData {
  const titleMatch = /<dc:title[^>]*>([^<]+)<\/dc:title>/i.exec(xml);
  const authorMatch = /<dc:creator[^>]*>([^<]+)<\/dc:creator>/i.exec(xml);

  const manifest = new Map<string, string>();
  const manifestRe = /<item\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = manifestRe.exec(xml)) !== null) {
    const attrs = m[1] as string;
    const id = /\bid=["']([^"']+)["']/i.exec(attrs);
    const href = /\bhref=["']([^"']+)["']/i.exec(attrs);
    if (id !== null && href !== null) manifest.set(id[1] as string, href[1] as string);
  }

  const spineIds: string[] = [];
  const itemrefRe = /<itemref\b[^>]*\bidref=["']([^"']+)["']/gi;
  while ((m = itemrefRe.exec(xml)) !== null) {
    spineIds.push(m[1] as string);
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const spinePaths = spineIds
    .map((id) => manifest.get(id))
    .filter((href): href is string => href !== undefined)
    .map((href) => resolvePath(opfDir, href));

  return {
    title: titleMatch !== null ? decodeEntities((titleMatch[1] as string).trim()) : 'Untitled',
    author: authorMatch !== null ? decodeEntities((authorMatch[1] as string).trim()) : null,
    spinePaths,
  };
}

function resolvePath(baseDir: string, href: string): string {
  if (href.startsWith('/')) return href.slice(1);
  // Collapse parent refs (../). Naive but sufficient for EPUB layouts.
  const segments = (baseDir + href).split('/');
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '..') out.pop();
    else if (seg !== '' && seg !== '.') out.push(seg);
  }
  return out.join('/');
}

// Sentinels distinguish "real" line breaks from source-whitespace newlines
// inside HTML. After tag replacement they survive whitespace collapse,
// then get rendered as the right kind of newline at the end.
const PARA_BREAK = '';
const LINE_BREAK = '';

export function stripHtml(html: string): string {
  let s = html
    .replace(/<\s*(p|div|h[1-6]|li|blockquote|tr|hr)\b[^>]*>/gi, PARA_BREAK)
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote|tr|hr)\s*>/gi, PARA_BREAK)
    .replace(/<\s*br\s*\/?\s*>/gi, LINE_BREAK)
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  // Collapse ALL whitespace (incl. source newlines) to a single space.
  s = s.replace(/\s+/g, ' ');
  // Restore boundaries as their canonical break form.
  s = s.replace(new RegExp(`\\s*${PARA_BREAK}\\s*`, 'g'), '\n\n');
  s = s.replace(new RegExp(`\\s*${LINE_BREAK}\\s*`, 'g'), '\n');
  // Collapse 3+ newlines down to 2.
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
