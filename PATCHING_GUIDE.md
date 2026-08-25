# Teacher HQ — Patch Workflow from v18 onward

## Patch sizes
### Patch
One feature or bug. Normally **1 feature file**, occasionally plus one existing legacy file while extraction is still in progress.

### Feature batch
Several closely related changes in one feature. Normally **1–3 files**.

### Release
Only for a true architecture/data migration or coordinated redesign across multiple features.

## Before changing code
Write a tiny change manifest:

- Feature: Cohorts
- Primary file: `feature-cohorts.js`
- Legacy file touched: none (ideal) / `classes.js` (transitional only)
- Data schema change: no
- Other features affected: none

## Dependency rule
If a change can be implemented within one feature boundary, do not inspect or regenerate unrelated features.

## CSS rule
For small feature CSS patches, inject CSS from that feature file using:

```js
ctx.styles.replace("feature-cohorts", `
  .some-cohort-selector { ... }
`);
```

This keeps the style patch next to the behaviour patch. If a feature's CSS becomes large, split it later into a dedicated feature stylesheet rather than returning to `styles.css` as a catch-all.

## Git rule
Each independent batch gets its own commit. Examples:

- `Improve cohort attention grabber editor`
- `Add unit resource filtering`
- `Fix Calendar View archive markers`

## Rollback rule
Never combine unrelated changes merely because they were requested in one message. If one batch fails, its commit should be revertible without removing another working feature.

## Dataset rule
Do not edit curriculum/progression data files for UI behaviour. Dataset files change only when curriculum/progression source data itself changes or is corrected.
