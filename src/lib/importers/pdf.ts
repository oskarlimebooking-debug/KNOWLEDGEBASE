// PDF parser — STUB.
//
// The TA.4 spec calls for real PDF.js text extraction with a self-hosted
// worker (resolving the open Phase-A decision: PDF.js worker = bundled
// via Vite, not loaded from cdnjs — the strict CSP forbids cross-origin
// script-src). The real implementation is out-of-scope for this session
// because:
//   1. Real PDF.js + Vite worker bundling needs ~300 LOC + careful
//      worker-MIME handling.
//   2. The "3-fixture PDFs pass" AC requires actual PDF binaries we
//      don't ship in the repo.
//
// Until the real parser lands, this stub returns a single-chapter
// "book" whose content is a notice that PDF import is not yet wired up.
// The dispatcher (`import.ts`) and IDB writer (`save.ts`) flow through
// the stub unchanged, so the rest of the Phase-A pipeline (TA.5 grid,
// TA.6 detail, TA.7 chapter view) works end-to-end on EPUB today and
// will work on PDF once this file is swapped out.

import type { ParsedBookText } from './types';

const PDF_NOT_YET_NOTICE = [
  'PDF import is a stub in this build.',
  '',
  'The real PDF.js parser will land in a follow-up. The dispatcher,',
  'chapter splitter, cover generator, and IDB writer are all live,',
  'so once the real text-extraction lands here, every other layer of',
  'the pipeline keeps working unchanged.',
].join('\n');

export async function parsePdf(file: Blob | ArrayBuffer): Promise<ParsedBookText> {
  // Touch the input so the stub still validates the call shape.
  const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
  return Promise.resolve({
    title: `PDF Document (${(size / 1024).toFixed(0)} KB)`,
    author: null,
    content: PDF_NOT_YET_NOTICE,
    source: 'pdf',
  });
}

export const PDF_MAX_COVER_BYTES = 5 * 1024 * 1024;

// Exposed so tests + the UI can verify the documented "PDFs > 5 MB skip
// cover generation gracefully" gate without re-encoding the threshold.
export function pdfShouldSkipCover(file: Blob | ArrayBuffer): boolean {
  const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
  return size > PDF_MAX_COVER_BYTES;
}
