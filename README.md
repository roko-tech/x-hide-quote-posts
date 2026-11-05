<div align="center">

# X: Hide Quote Posts

Hide posts that quote someone else in X/Twitter's **For You** feed, plus the "Who to follow" block in your Home feed.

[![Install userscript](https://img.shields.io/badge/Install-userscript-2f81f7?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js)

[![Version](https://img.shields.io/badge/version-1.8.0-8b5cf6)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![Test](https://github.com/roko-tech/x-hide-quote-posts/actions/workflows/test.yml/badge.svg)](https://github.com/roko-tech/x-hide-quote-posts/actions/workflows/test.yml)

</div>

## Highlights

- Collapses quote posts of other people's posts in **For You** to a slim "Quote post hidden" line.
- Keeps original posts, reposts, self-quotes, and direct video-link embeds visible.
- Leaves **Following**, profiles, search, and post pages untouched.
- Removes the "Who to follow" block from the Home feed, on both tabs. The sidebar box stays.
- Optionally hides posts you already scrolled past, from your next visit on.
- Adds toggle icons next to the **For you** / **Following** tabs that apply to every open X tab.
- Makes **J** / **K** and **Tab** skip everything that's hidden.

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Click **[Install X: Hide Quote Posts](https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js)**.
3. Approve the installation, then reload any open X tabs.

The userscript checks this repository for updates through its `@updateURL`.

## Usage

Open [x.com/home](https://x.com/home). Two icons in the timeline header, next to the tabs, control the filters. Each is blue with a slash while it hides something and grey while it doesn't.

| Icon | Hides | Shown on | Default |
| --- | --- | --- | --- |
| Quote marks | Quote posts of other people's posts | **For you** | On |
| Eye | Posts you already scrolled past | **For you** and **Following** | Off |

Your choices are remembered across reloads, and other open X tabs switch with them. The "Who to follow" block is always removed from the Home feed.

**J** / **K** skip everything that's hidden: when X lands on a hidden post, the script repeats the same key so X moves on to the next visible one. **Tab** and **Shift+Tab** skip them too. Going up past the removed "Who to follow" block, X itself needs one extra **K** press, with or without the script.

## Hiding posts you've seen

With the eye icon on, a post counts as seen once all of it has scrolled up past the top of the screen. Seen posts are hidden completely, with no placeholder, the next time you load the Home feed. Posts you scroll past stay where they are until then, so nothing jumps while you read, open a post, or go back.

Seen posts are remembered for 7 days, up to the 5,000 most recent. A collapsed quote post doesn't count as seen, because you never saw its content. Turning the eye off shows them again and stops recording.

## What counts as a quote post

A post is hidden when it embeds a quote card or status link from a **different** author. Only the directly quoted post counts: if that post quotes someone else in turn, the inner quote is ignored. These stay visible:

- **Self-quotes**, where the quoted post has the same author.
- **Direct video embeds**, where an explicit `/video/` link or X's `/i/status/…` link sits inside the video player without a quote card. Once recognized, the post stays visible while X swaps the player DOM on hover.

Hidden posts keep a fixed 20 px height, and the script never changes the scroll position, so scrolling stays stable in both directions.

## How "Who to follow" is found

X shows the block as separate feed rows: a heading row, then one row per suggested account. The script collapses every Home feed row that holds an account card, plus the row just before the first one, so it works in any interface language. Only the timeline column is affected.

## Privacy

The script runs entirely in the page. It makes no network requests and uses no userscript manager permissions (`@grant none`). It stores everything in your browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `x-hide-quote-posts-enabled` | Quote icon on or off |
| `x-hide-quote-posts-seen-enabled` | Eye icon on or off |
| `x-hide-quote-posts-seen` | IDs of posts you scrolled past, with the time, for 7 days. Only recorded while the eye icon is on. |

## Limitations

- It relies on X's page structure, which X changes without notice. If posts stop being hidden, check for an update or [open an issue](https://github.com/roko-tech/x-hide-quote-posts/issues).
- The placeholder text is English only.
- Quotes of deleted or unavailable posts stay visible, because they show no quoted author to compare.
- Tested with Violentmonkey in Chrome. Other managers that support `@grant none` scripts should work but are untested.

## Development

There is no build step. The root `.user.js` file is both the source and the installable script, and it has no dependencies. The tests use [linkedom](https://github.com/WebReflection/linkedom) to run the detection code against trimmed copies of real X post markup in [`fixtures/`](fixtures/).

```sh
npm ci
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for reporting bugs and submitting changes.

## License

Released under the [MIT License](LICENSE).
