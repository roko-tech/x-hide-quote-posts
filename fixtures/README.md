# Test fixtures

Trimmed copies of real post markup from X's For You feed, captured on 2026-11-05. Only the elements and attributes the userscript reads are kept. All text is removed, and account names and post IDs are replaced.

Most files are captured as-is. These were made by editing a captured file to cover a case not seen live:

| File | Derived from | Change |
| --- | --- | --- |
| `nested-self-quote.html` | `nested-quote.html` | Quoted author renamed to the post author |
| `video-embed-status-link.html` | `video-embed.html` | `/i/status/` link added inside the video player |
| `video-embed-hovered.html` | `video-embed-status-link.html` | Same link, moved out of the player as happens on hover |
| `pending.html` | `cross-quote.html` | Timestamp permalink removed, as before X finishes rendering |

When X changes its markup, capture fresh copies the same way and rerun `npm test`.
