# Contributing

Thanks for helping improve X: Hide Quote Posts.

## Before opening an issue

- Confirm the problem still occurs with the latest userscript version.
- Include your browser and userscript manager versions.
- Link the post that was hidden or shown by mistake, if it is public.
- Say whether the toggle icon was blue (hiding) or grey (showing).

Please avoid posting cookies, account credentials, or screenshots with private information.

## Making a change

Keep changes focused and preserve the single-file userscript design. There is no build step, and the userscript itself must stay dependency-free.

Before submitting:

```sh
npm ci
npm test
```

If a change depends on how X marks up posts, add or refresh a fixture in [`fixtures/`](fixtures/) as described in its README.

For changes to filtering, the toggle, or keyboard navigation, also test on a signed-in For You feed: confirm quote posts collapse, the icon toggles them in every open tab, and J / K and Tab skip hidden posts in both directions.
