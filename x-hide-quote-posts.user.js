// ==UserScript==
// @name         X: Hide Quote Posts
// @namespace    https://github.com/roko-tech
// @version      1.8.0
// @description  Hides cross-author quote posts in For You, the "Who to follow" block in the Home feed, and optionally posts you already scrolled past.
// @author       roko-tech
// @license      MIT
// @homepageURL  https://github.com/roko-tech/x-hide-quote-posts
// @supportURL   https://github.com/roko-tech/x-hide-quote-posts/issues
// @updateURL    https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js
// @downloadURL  https://raw.githubusercontent.com/roko-tech/x-hide-quote-posts/main/x-hide-quote-posts.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const POST_SELECTOR = 'article[data-testid="tweet"]';
    const STATUS_LINK_SELECTOR = 'a[href*="/status/"]';
    // A quote inside the quoted post gets its own nested card; only the directly quoted post counts.
    const QUOTE_CARD_SELECTOR = 'div[role="link"][tabindex="0"]:not([data-testid="nestedQuotePreview"])';
    const AVATAR_SELECTOR = '[data-testid^="UserAvatar-Container-"]';
    const VIDEO_SELECTOR = '[data-testid="videoComponent"], [data-testid="videoPlayer"], video[aria-label="Embedded video"], button[aria-label^="Play Video"], a[href*="/video/"]';
    const AVATAR_PREFIX = 'UserAvatar-Container-';
    // The feed shows "Who to follow" as separate timeline rows: a heading row, then one row per suggested account.
    const WHO_TO_FOLLOW_ROW_SELECTOR = '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]'
        + ':is(:has([data-testid="UserCell"]), :has(+ [data-testid="cellInnerDiv"] [data-testid="UserCell"]))';
    // X rewrites a post's class attribute when it re-renders (on focus, for example), so hidden posts are marked
    // with an attribute X never touches.
    const HIDDEN_ATTR = 'data-x-hide-quote-posts-hidden';
    const SEEN_ATTR = 'data-x-hide-quote-posts-seen';
    const SEEN_ROW_SELECTOR = `[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]:has([${SEEN_ATTR}])`;
    const FILTER_ACTIVE_CLASS = 'x-hide-quote-posts-active';
    const HOME_FEED_CLASS = 'x-hide-quote-posts-home';
    const SEEN_ACTIVE_CLASS = 'x-hide-quote-posts-seen-active';
    // Rows collapsed to zero height rather than display: none, so X's J/K can still focus them and the script can skip them.
    const COLLAPSED_ROW_SELECTOR = `html.${HOME_FEED_CLASS} ${WHO_TO_FOLLOW_ROW_SELECTOR}, html.${SEEN_ACTIVE_CLASS} ${SEEN_ROW_SELECTOR}`;
    const BUTTON_CLASS = 'x-hide-quote-posts-button';
    const TOGGLE_ID = 'x-hide-quote-posts-toggle';
    const SEEN_TOGGLE_ID = 'x-hide-quote-posts-seen-toggle';
    const STORAGE_KEY = 'x-hide-quote-posts-enabled';
    const SEEN_ENABLED_KEY = 'x-hide-quote-posts-seen-enabled';
    const SEEN_POSTS_KEY = 'x-hide-quote-posts-seen';
    const SEEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const SEEN_MAX_POSTS = 5000;
    const J_CHAR_CODE = 106;
    const K_CHAR_CODE = 107;

    function statusIdFromHref(href) {
        return href?.match(/\/status\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
    }

    function authorFromStatusHref(href) {
        const author = href?.match(/\/([^/?#]+)\/status\/\d+/)?.[1]?.toLowerCase() ?? null;
        return author === 'web' && href.includes('/i/web/status/') ? null : author;
    }

    function authorFromAvatar(avatar) {
        const testId = avatar?.getAttribute('data-testid');
        return testId?.startsWith(AVATAR_PREFIX)
            ? testId.slice(AVATAR_PREFIX.length).toLowerCase()
            : null;
    }

    function isForYouSelection(pathname, selectedTabIndex) {
        return pathname === '/home' && selectedTabIndex === 0;
    }

    // Returns { postId, kind }, where kind is one of:
    // 'pending' (X has not rendered enough yet), 'original', 'self-quote', 'quote', 'video-embed'.
    function classifyPost(post) {
        const timestampLink = post.querySelector('time')?.closest(STATUS_LINK_SELECTOR);
        const postId = statusIdFromHref(timestampLink?.getAttribute('href'));
        if (!postId) return { postId, kind: 'pending' };

        const postAuthor = authorFromStatusHref(timestampLink.getAttribute('href'))
            ?? authorFromAvatar(post.querySelector(`[data-testid="Tweet-User-Avatar"] ${AVATAR_SELECTOR}`));

        const quotedAuthors = Array.from(post.querySelectorAll(QUOTE_CARD_SELECTOR))
            .map((card) => authorFromAvatar(card.querySelector(AVATAR_SELECTOR)))
            .filter(Boolean);

        if (quotedAuthors.length > 0) {
            if (postAuthor === null) return { postId, kind: 'pending' };
            return { postId, kind: quotedAuthors.some((author) => author !== postAuthor) ? 'quote' : 'self-quote' };
        }

        const linkedPosts = Array.from(post.querySelectorAll(STATUS_LINK_SELECTOR)).filter((link) => {
            const linkedPostId = statusIdFromHref(link.getAttribute('href'));
            return linkedPostId !== null && linkedPostId !== postId;
        });
        if (linkedPosts.some((link) => link.getAttribute('href')?.includes('/video/')
            || link.closest(VIDEO_SELECTOR))) {
            return { postId, kind: 'video-embed' };
        }

        const quotesOtherAuthor = linkedPosts.some((link) => {
            const linkedAuthor = authorFromStatusHref(link.getAttribute('href'));
            return linkedAuthor !== null
                && postAuthor !== null
                && linkedAuthor !== postAuthor;
        });
        if (quotesOtherAuthor) return { postId, kind: 'quote' };
        return { postId, kind: linkedPosts.length > 0 ? 'self-quote' : 'original' };
    }

    // Hovering a video embed swaps its player DOM, after which it looks like a quote,
    // so embeds are remembered by post ID once recognized.
    function shouldHidePost({ postId, kind }, videoEmbedPostIds) {
        if (kind === 'video-embed') videoEmbedPostIds.add(postId);
        return kind === 'quote' && !videoEmbedPostIds.has(postId);
    }

    // Seen posts are stored as { postId: firstSeenTime }. Keeps the most recent ones within the age limit.
    function pruneSeenPosts(seenPosts, now) {
        return Object.fromEntries(Object.entries(seenPosts)
            .filter(([, seenAt]) => typeof seenAt === 'number' && now - seenAt < SEEN_MAX_AGE_MS)
            .sort(([, a], [, b]) => b - a)
            .slice(0, SEEN_MAX_POSTS));
    }

    // A corrupt stored value must not stop the script, which runs before X's page loads.
    function parseSeenPosts(json) {
        try {
            const seenPosts = JSON.parse(json);
            return seenPosts && typeof seenPosts === 'object' && !Array.isArray(seenPosts) ? seenPosts : {};
        } catch {
            return {};
        }
    }

    if (typeof module === 'object' && module.exports) {
        module.exports = {
            statusIdFromHref,
            authorFromStatusHref,
            classifyPost,
            shouldHidePost,
            isForYouSelection,
            pruneSeenPosts,
            parseSeenPosts,
            WHO_TO_FOLLOW_ROW_SELECTOR,
            SEEN_ROW_SELECTOR
        };
    }
    if (typeof document === 'undefined') return;

    let filterEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let seenEnabled = localStorage.getItem(SEEN_ENABLED_KEY) === 'true';
    // Only posts seen before this page load are hidden, so nothing moves while you scroll.
    const seenBeforeLoad = new Set(Object.keys(
        pruneSeenPosts(parseSeenPosts(localStorage.getItem(SEEN_POSTS_KEY)), Date.now())
    ));

    const style = document.createElement('style');
    style.textContent = `
        html.${FILTER_ACTIVE_CLASS} [${HIDDEN_ATTR}] {
            box-sizing: border-box;
            height: 20px !important;
            max-height: 20px !important;
            min-height: 20px !important;
            overflow: hidden !important;
            pointer-events: none;
            position: relative;
        }
        html.${FILTER_ACTIVE_CLASS} [${HIDDEN_ATTR}] > * {
            display: none !important;
        }
        html.${FILTER_ACTIVE_CLASS} [${HIDDEN_ATTR}]::after {
            align-items: center;
            color: rgb(113, 118, 123);
            content: 'Quote post hidden';
            display: flex;
            font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            inset: 0;
            justify-content: center;
            position: absolute;
        }
        ${COLLAPSED_ROW_SELECTOR} {
            height: 0 !important;
            overflow: hidden !important;
        }
        .${BUTTON_CLASS} {
            align-items: center;
            align-self: center;
            background: transparent;
            border: 0;
            border-radius: 9999px;
            color: rgb(113, 118, 123);
            cursor: pointer;
            display: flex;
            flex-shrink: 0;
            height: 36px;
            justify-content: center;
            margin: 0 4px;
            padding: 0;
            width: 36px;
        }
        .${BUTTON_CLASS}[hidden] { display: none; }
        .${BUTTON_CLASS}:hover { background: rgba(128, 128, 128, 0.15); }
        .${BUTTON_CLASS}[aria-pressed="true"] { color: rgb(29, 155, 240); }
        .${BUTTON_CLASS} svg { fill: currentColor; height: 20px; width: 20px; }
        .${BUTTON_CLASS} .x-hide-quote-posts-slash { stroke: currentColor; stroke-linecap: round; stroke-width: 2; }
        .${BUTTON_CLASS}[aria-pressed="false"] :is(.x-hide-quote-posts-slash, .x-hide-quote-posts-slash-gap) { display: none; }
    `;
    document.documentElement.appendChild(style);

    const QUOTE_ICON = 'M4 10.5A3.5 3.5 0 1 1 10.5 12c-.8 2.4-2.5 4.2-5 5l-.7-1.3'
        + 'c1.4-.7 2.4-1.8 2.9-3A3.5 3.5 0 0 1 4 10.5zm9 0a3.5 3.5 0 1 1 6.5 1.5c-.8 2.4-2.5 4.2-5 5l-.7-1.3'
        + 'c1.4-.7 2.4-1.8 2.9-3A3.5 3.5 0 0 1 13 10.5z';
    // An eye outline with a pupil, drawn with the even-odd fill rule.
    const EYE_ICON = 'M12 5C6.5 5 2.7 9.3 1.5 12c1.2 2.7 5 7 10.5 7s9.3-4.3 10.5-7C21.3 9.3 17.5 5 12 5z'
        + 'm0 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z';

    // When pressed, the icon gets a slash with a gap cut out of the icon around it.
    function createToggleButton(id, iconPath) {
        const button = document.createElement('button');
        button.id = id;
        button.className = BUTTON_CLASS;
        button.type = 'button';
        button.hidden = true;
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + `<mask id="${id}-cut"><rect width="24" height="24" fill="#fff"/>`
            + '<path class="x-hide-quote-posts-slash-gap" d="M3 3l18 18" stroke="#000" stroke-width="5"/></mask>'
            + `<path mask="url(#${id}-cut)" fill-rule="evenodd" d="${iconPath}"/>`
            + '<path class="x-hide-quote-posts-slash" d="M3 3l18 18"/></svg>';
        return button;
    }

    const toggleButton = createToggleButton(TOGGLE_ID, QUOTE_ICON);
    const seenButton = createToggleButton(SEEN_TOGGLE_ID, EYE_ICON);

    function setButtonState(button, pressed, label) {
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(pressed));
        button.title = label;
    }

    function updateToggleButtons() {
        setButtonState(toggleButton, filterEnabled, filterEnabled ? 'Show quote posts' : 'Hide quote posts');
        setButtonState(seenButton, seenEnabled, seenEnabled
            ? 'Show posts you already scrolled past'
            : 'Hide posts you already scrolled past, starting from your next visit');
    }

    // They sit in the timeline header, between the For you / Following tabs and X's own buttons.
    function ensureToggleButtons() {
        const tabsWrapper = document.querySelector('main [role="tablist"]')?.closest('nav')?.parentElement;
        if (!tabsWrapper) return;
        if (tabsWrapper.nextElementSibling !== toggleButton) tabsWrapper.after(toggleButton);
        if (toggleButton.nextElementSibling !== seenButton) toggleButton.after(seenButton);
    }

    let filterActive = false;
    let seenActive = false;
    function updateFilterContext() {
        const tabs = Array.from(document.querySelectorAll('main [role="tab"]')).slice(0, 2);
        const selectedTabIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
        const isForYou = isForYouSelection(location.pathname, selectedTabIndex);
        const onHomeFeed = location.pathname === '/home';
        filterActive = filterEnabled && isForYou;
        seenActive = seenEnabled && onHomeFeed;
        document.documentElement.classList.toggle(FILTER_ACTIVE_CLASS, filterActive);
        document.documentElement.classList.toggle(HOME_FEED_CLASS, onHomeFeed);
        document.documentElement.classList.toggle(SEEN_ACTIVE_CLASS, seenActive);
        toggleButton.hidden = !isForYou;
        seenButton.hidden = !onHomeFeed;
    }

    function setFilterEnabled(enabled) {
        filterEnabled = enabled;
        updateFilterContext();
        updateToggleButtons();
    }

    function setSeenEnabled(enabled) {
        seenEnabled = enabled;
        updateFilterContext();
        updateToggleButtons();
    }

    toggleButton.addEventListener('click', () => {
        setFilterEnabled(!filterEnabled);
        localStorage.setItem(STORAGE_KEY, String(filterEnabled));
    });
    seenButton.addEventListener('click', () => {
        setSeenEnabled(!seenEnabled);
        localStorage.setItem(SEEN_ENABLED_KEY, String(seenEnabled));
    });
    // Other X tabs follow the toggles; the storage event only fires in tabs that did not make the change.
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) setFilterEnabled(event.newValue !== 'false');
        if (event.key === SEEN_ENABLED_KEY) setSeenEnabled(event.newValue === 'true');
    });
    updateToggleButtons();
    ensureToggleButtons();
    updateFilterContext();

    // X moves between posts on the j/k keypress and tracks the current post itself,
    // so when it lands on a hidden post or row, repeat the same keypress instead of moving focus.
    let navCharCode = 0;
    document.addEventListener('keydown', (event) => {
        navCharCode = 0;
        if (event.key !== 'Tab') return;

        // Tab would stop on collapsed posts and rows, but X's J/K refuse to move onto anything unfocusable,
        // so they leave the tab order only while this Tab press moves focus. A collapsed post's only
        // focusable element is the post itself; a row holds links and buttons, so the whole row goes inert.
        const collapsedPosts = filterActive ? document.querySelectorAll(`${POST_SELECTOR}[${HIDDEN_ATTR}]`) : [];
        const collapsedRows = Array.from(document.querySelectorAll(COLLAPSED_ROW_SELECTOR))
            .filter((row) => !row.contains(document.activeElement));
        for (const post of collapsedPosts) post.tabIndex = -1;
        for (const row of collapsedRows) row.inert = true;
        setTimeout(() => {
            for (const post of collapsedPosts) post.tabIndex = 0;
            for (const row of collapsedRows) row.inert = false;
        });
    }, true);
    document.addEventListener('keypress', (event) => {
        navCharCode = event.charCode === J_CHAR_CODE || event.charCode === K_CHAR_CODE ? event.charCode : 0;
    }, true);
    document.addEventListener('focusin', (event) => {
        const target = event.target;
        const collapsed = (filterActive && target.matches(`${POST_SELECTOR}[${HIDDEN_ATTR}]`))
            || target.closest(COLLAPSED_ROW_SELECTOR);
        if (!navCharCode || !collapsed) return;

        const charCode = navCharCode;
        // X also counts a few unfocusable rows as stops, so press again while focus has not moved.
        setTimeout(() => {
            for (let tries = 0; tries < 3 && document.activeElement === target; tries++) {
                target.dispatchEvent(new KeyboardEvent('keypress', {
                    key: String.fromCharCode(charCode),
                    charCode,
                    keyCode: charCode,
                    which: charCode,
                    bubbles: true,
                    cancelable: true
                }));
            }
        });
    });

    const newlySeenPosts = {};
    let seenSaveQueued = false;

    function saveSeenPosts() {
        seenSaveQueued = false;
        // Merge with what other X tabs saved in the meantime.
        const seenPosts = { ...parseSeenPosts(localStorage.getItem(SEEN_POSTS_KEY)), ...newlySeenPosts };
        try {
            localStorage.setItem(SEEN_POSTS_KEY, JSON.stringify(pruneSeenPosts(seenPosts, Date.now())));
        } catch {
            // Storage is full (X shares it); this visit's seen posts are simply not remembered.
        }
    }

    // A post counts as seen once all of it has scrolled up past the top of the screen.
    const seenObserver = new IntersectionObserver((entries) => {
        for (const { target: post, isIntersecting, boundingClientRect } of entries) {
            if (isIntersecting || boundingClientRect.bottom > 0) continue;

            seenObserver.unobserve(post);
            const { postId } = classifyPost(post);
            const shownAsPlaceholder = filterActive && post.hasAttribute(HIDDEN_ATTR);
            if (!seenActive || !postId || shownAsPlaceholder || !post.closest('[data-testid="primaryColumn"]')) continue;

            newlySeenPosts[postId] = Date.now();
            if (seenSaveQueued) continue;
            seenSaveQueued = true;
            setTimeout(saveSeenPosts, 1000);
        }
    });

    const pendingPosts = new Set();
    const videoEmbedPostIds = new Set();
    let flushQueued = false;

    function flush() {
        flushQueued = false;
        for (const post of pendingPosts) {
            const classification = classifyPost(post);
            post.toggleAttribute(HIDDEN_ATTR, shouldHidePost(classification, videoEmbedPostIds));
            post.toggleAttribute(SEEN_ATTR, seenBeforeLoad.has(classification.postId));
            if (!seenBeforeLoad.has(classification.postId) && !Object.hasOwn(newlySeenPosts, classification.postId)) {
                seenObserver.observe(post);
            }
        }
        pendingPosts.clear();
    }

    function queuePost(post) {
        if (!post) return;
        pendingPosts.add(post);
        if (flushQueued) return;

        flushQueued = true;
        queueMicrotask(flush);
    }

    function queuePostsFrom(node) {
        if (!(node instanceof Element)) return;

        queuePost(node.matches(POST_SELECTOR) ? node : node.closest(POST_SELECTOR));
        for (const post of node.querySelectorAll(POST_SELECTOR)) queuePost(post);
    }

    for (const post of document.querySelectorAll(POST_SELECTOR)) queuePost(post);

    const observer = new MutationObserver((mutations) => {
        ensureToggleButtons();
        updateFilterContext();
        for (const mutation of mutations) {
            if (mutation.target instanceof Element) {
                queuePost(mutation.target.closest(POST_SELECTOR));
            }
            for (const node of mutation.addedNodes) queuePostsFrom(node);
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'data-testid', 'aria-selected']
    });
})();
