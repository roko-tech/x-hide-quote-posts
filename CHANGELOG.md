# Changelog

All notable changes to X: Hide Quote Posts are documented here.

## 1.7.0 — 2026-11-05

- Removes the "Who to follow" block from the Home feed, on both tabs. The sidebar box is unchanged, and the quote icon doesn't affect it.
- J / K and Tab skip the removed block, so it doesn't leave invisible stops.
- J / K also press past a stop X can't focus right after a hidden post, instead of stalling there.

## 1.6.0 — 2026-11-05

- Changed the placeholder to a slim 20 px line in X's own font. It was 52 px and rendered in Times New Roman.
- The toggle now applies to every open X tab, not just the one you clicked in.
- Tab and Shift+Tab now skip hidden posts.
- Fixed hidden posts briefly expanding to full size when X re-rendered them, for example when J / K focused them.
- Fixed a self-quote being hidden when the quoted post itself quotes someone else.

## 1.5.0 — 2026-11-05

Initial public release.

- Hides cross-author quote posts in the For You feed behind a fixed 52 px placeholder.
- Keeps original posts, reposts, self-quotes, and direct video-link embeds visible.
- Adds a toggle icon next to the For you / Following tabs that only appears on For You and remembers its state.
- Makes the J / K keyboard shortcuts skip hidden posts.
