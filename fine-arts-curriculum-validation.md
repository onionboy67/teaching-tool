# Teacher HQ Fine Arts Curriculum Validation

**Fine Arts selectable records added:** 2849

## Architecture

- Fine Arts is stored as the subject, with Art, Drama, Music, and optional Arts Competencies as variable-depth disciplines/branches.
- Art and Drama start at Grade 1; no Kindergarten Art/Drama records were added.
- Elementary Music required/elective and grade-introduction metadata are derived from the official scope-and-sequence chart symbols.
- Junior-high Drama and Music carry the official 30% elective-time ceiling as metadata.
- Junior-high Music Choral/Instrumental detailed outcomes are not invented; only the supplied program framework/goals are represented.

## Record counts

| Grade | Art | Drama | Music | Arts Competencies | Total |
|---|---:|---:|---:|---:|---:|
| Grade 1 | 107 | 94 | 62 | 33 | 296 |
| Grade 2 | 107 | 94 | 98 | 33 | 332 |
| Grade 3 | 109 | 102 | 136 | 33 | 380 |
| Grade 4 | 109 | 102 | 173 | 33 | 417 |
| Grade 5 | 109 | 114 | 197 | 33 | 453 |
| Grade 6 | 109 | 114 | 211 | 33 | 467 |
| Grade 7 | 44 | 78 | 23 | 33 | 178 |
| Grade 8 | 47 | 64 | 25 | 33 | 169 |
| Grade 9 | 43 | 57 | 24 | 33 | 157 |

## Record roles

- **assessmentTarget:** 108
- **competency:** 297
- **concept:** 731
- **mediaTechnique:** 254
- **module:** 27
- **programGoal:** 45
- **skill:** 1387

## Source integrity notes

- Existing Math, Science, ELA, and PE curriculum data remain in `curriculum-data.js` and are not rewritten in this release.
- Fine Arts is isolated in `fine-arts-data.js` to reduce the chance of large-file editing/commit issues and to keep the legacy curriculum catalogue stable.
- The curriculum browser now starts branches collapsed, including Cross-Curricular Connections, and expands only the branches the user opens.