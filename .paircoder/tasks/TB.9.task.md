---
id: TB.9
title: Markdown renderer + sanitizer
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: done
sprint: '0'
depends_on: []
completed_at: '2026-05-13T08:40:39.085533'
---

# Markdown renderer + sanitizer

In-house renderer for `# / ## / ###`, bold/italic, bullet & numbered lists, blockquotes, inline code, code blocks, links (`target=_blank`, `rel=noopener`). Followed by `sanitizeHtml(html)` whitelisting block + inline tags and attributes. Defends against malicious chapter content.

# Acceptance Criteria

- [x] All listed Markdown features render correctly
- [x] XSS fixture (`<script>`, `onerror=`, `javascript:`) is neutralized
- [x] Vitest test suite covers every renderer rule
- [x] Links open in new tab with noopener