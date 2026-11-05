# X: Hide Quote Posts

A private Violentmonkey userscript that hides posts quoting someone else in X/Twitter's **For You** feed. Normal quote cards are hidden even when the quoted post contains a video. The **Following** feed, profiles, search, post pages, original posts, ordinary reposts, self-quotes, and direct video-link embeds remain visible.

Direct video embeds are recognized when an explicit `/video/` link or X's generic `/i/status/…` link is nested directly inside the video player without a normal quote card. Once recognized, the post stays exempt while X swaps the thumbnail and player DOM during hover.

Use the quote icon in the timeline header, next to the **For you** / **Following** tabs, to toggle filtering. Blue with a slash means quote posts are hidden; grey means they are shown. The icon appears only while **For You** is selected, and the choice persists across page reloads.

The **J** / **K** keyboard shortcuts skip hidden posts. When X lands on one, the script repeats the same key so X moves on to the next visible post.

Hidden quote posts always use the same compact 52 px placeholder in both scroll directions. The script never changes the browser's scroll position, avoiding the direction-dependent row heights that destabilized upward scrolling in earlier versions.

## Install

1. Open `x-hide-quote-posts.user.js` in Chrome, or drag it into a browser tab.
2. Confirm the installation or replacement in Violentmonkey.
3. Reload any open X/Twitter tabs.

If an older version is already installed, reopen the updated file and replace it with version 1.5.0 before reloading X.

For local editing, enable **Track external edits** on Violentmonkey's installer page while that page remains open.

## Verify

```powershell
node --check .\x-hide-quote-posts.user.js
node --test .\x-hide-quote-posts.test.cjs
```
