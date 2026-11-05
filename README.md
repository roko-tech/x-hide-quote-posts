<div align="center">

# X: Hide Quote Posts

Hide posts that quote someone else in X/Twitter's **For You** feed.

[![Install userscript](https://img.shields.io/badge/Install-userscript-2f81f7?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js)

[![Version](https://img.shields.io/badge/version-1.5.0-8b5cf6)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![Test](https://github.com/roko-tech/x-hide-quote-posts/actions/workflows/test.yml/badge.svg)](https://github.com/roko-tech/x-hide-quote-posts/actions/workflows/test.yml)

</div>

## Highlights

- Collapses quote posts of other people's posts in **For You** to a small "Quote post hidden" placeholder.
- Keeps original posts, reposts, self-quotes, and direct video-link embeds visible.
- Leaves **Following**, profiles, search, and post pages untouched.
- Adds a toggle icon next to the **For you** / **Following** tabs.
- Makes the **J** / **K** keyboard shortcuts skip hidden posts.

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Click **[Install X: Hide Quote Posts](https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js)**.
3. Approve the installation, then reload any open X tabs.

The userscript checks this repository for updates through its `@updateURL`.

## Usage

Open the **For you** tab on [x.com/home](https://x.com/home). The quote icon in the timeline header toggles filtering:

| Icon | Meaning | Click to |
| --- | --- | --- |
| Blue, with a slash | Quote posts are hidden | Show them |
| Grey | Quote posts are shown | Hide them |

The icon only appears on **For you**, and your choice is remembered across reloads.

**J** / **K** skip hidden posts: when X lands on one, the script repeats the same key so X moves on to the next visible post.

## What counts as a quote post

A post is hidden when it embeds a quote card or status link from a **different** author. These stay visible:

- **Self-quotes**, where the quoted post has the same author.
- **Direct video embeds**, where an explicit `/video/` link or X's `/i/status/…` link sits inside the video player without a quote card. Once recognized, the post stays visible while X swaps the player DOM on hover.

Hidden posts keep a fixed 52 px height, and the script never changes the scroll position, so scrolling stays stable in both directions.

## Privacy

The script runs entirely in the page. It makes no network requests, uses no userscript manager permissions (`@grant none`), and stores a single `localStorage` key, `x-hide-quote-posts-enabled`, for the toggle state.

## Limitations

- It relies on X's page structure, which X changes without notice. If posts stop being hidden, check for an update or [open an issue](https://github.com/roko-tech/x-hide-quote-posts/issues).
- The placeholder text is English only.
- Tested with Violentmonkey in Chrome. Other managers that support `@grant none` scripts should work but are untested.

## Development

There is no build step. The root `.user.js` file is both the source and the installable script.

```sh
node --check x-hide-quote-posts.user.js
node --test x-hide-quote-posts.test.cjs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for reporting bugs and submitting changes.

## License

Released under the [MIT License](LICENSE).
