# Contributing

Thanks for helping improve X: Hide Quote Posts.

## Before opening an issue

- Confirm the problem still occurs with the latest userscript version.
- Include your browser and userscript manager versions.
- Link the post that was hidden or shown by mistake, if it is public.
- Say whether the toggle icon was blue (hiding) or grey (showing).

Please avoid posting cookies, account credentials, or screenshots with private information.

## Making a change

Keep changes focused and preserve the single-file userscript design. There is no build step.

Before submitting:

```sh
node --check x-hide-quote-posts.user.js
node --test x-hide-quote-posts.test.cjs
```

For changes to filtering, the toggle, or keyboard navigation, also test on a signed-in For You feed: confirm quote posts collapse, the icon toggles them, and J / K skip hidden posts in both directions.
