---
id: TA.8
title: Settings modal
plan: plan-sprint-0-engage
type: feature
priority: P1
complexity: 3
status: pending
sprint: '0'
depends_on:
- TA.2
- TA.3
---

# Settings modal

Open / close via gear icon. Tabs (or sections): Reading, Data. Reading: reading speed (wpm) input, font size info. Data: Export All Data button (downloads a JSON of every IDB row).

# Acceptance Criteria

- [ ] Settings open/close from the header gear
- [ ] WPM input persists and validates (numeric, 50–1000)
- [ ] Export All Data round-trips: import the resulting JSON into a blank profile and the library is identical
- [ ] No console errors
