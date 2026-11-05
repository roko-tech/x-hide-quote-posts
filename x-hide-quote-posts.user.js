// ==UserScript==
// @name         X: Hide Quote Posts
// @namespace    https://github.com/roko-tech
// @version      1.6.0
// @description  Hides cross-author quote cards in For You while keeping Following, self-quotes, and direct video-link embeds visible.
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
    // X rewrites a post's class attribute when it re-renders (on focus, for example), so hidden posts are marked
    // with an attribute X never touches.
    const HIDDEN_ATTR = 'data-x-hide-quote-posts-hidden';
    const FILTER_ACTIVE_CLASS = 'x-hide-quote-posts-active';
    const TOGGLE_ID = 'x-hide-quote-posts-toggle';
    const STORAGE_KEY = 'x-hide-quote-posts-enabled';
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

    if (typeof module === 'object' && module.exports) {
        module.exports = {
            statusIdFromHref,
            authorFromStatusHref,
            classifyPost,
            shouldHidePost,
            isForYouSelection
        };
    }
    if (typeof document === 'undefined') return;

    let filterEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

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
        #${TOGGLE_ID} {
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
        #${TOGGLE_ID}[hidden] { display: none; }
        #${TOGGLE_ID}:hover { background: rgba(128, 128, 128, 0.15); }
        #${TOGGLE_ID}[aria-pressed="true"] { color: rgb(29, 155, 240); }
        #${TOGGLE_ID} svg { fill: currentColor; height: 20px; width: 20px; }
        #${TOGGLE_ID} .x-hide-quote-posts-slash { stroke: currentColor; stroke-linecap: round; stroke-width: 2; }
        #${TOGGLE_ID}[aria-pressed="true"] .x-hide-quote-posts-quote { mask: url(#x-hide-quote-posts-cut); }
        #${TOGGLE_ID}[aria-pressed="false"] .x-hide-quote-posts-slash { display: none; }
    `;
    document.documentElement.appendChild(style);

    const toggleButton = document.createElement('button');
    toggleButton.id = TOGGLE_ID;
    toggleButton.type = 'button';
    toggleButton.hidden = true;
    toggleButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<mask id="x-hide-quote-posts-cut"><rect width="24" height="24" fill="#fff"/>'
        + '<path d="M3 3l18 18" stroke="#000" stroke-width="5"/></mask>'
        + '<path class="x-hide-quote-posts-quote" d="M4 10.5A3.5 3.5 0 1 1 10.5 12c-.8 2.4-2.5 4.2-5 5l-.7-1.3'
        + 'c1.4-.7 2.4-1.8 2.9-3A3.5 3.5 0 0 1 4 10.5zm9 0a3.5 3.5 0 1 1 6.5 1.5c-.8 2.4-2.5 4.2-5 5l-.7-1.3'
        + 'c1.4-.7 2.4-1.8 2.9-3A3.5 3.5 0 0 1 13 10.5z"/>'
        + '<path class="x-hide-quote-posts-slash" d="M3 3l18 18"/></svg>';

    function updateToggleButton() {
        const label = filterEnabled ? 'Show quote posts' : 'Hide quote posts';
        toggleButton.setAttribute('aria-label', label);
        toggleButton.setAttribute('aria-pressed', String(filterEnabled));
        toggleButton.title = label;
    }

    // Sits in the timeline header, between the For you / Following tabs and X's own buttons.
    function ensureToggleButton() {
        const tabsWrapper = document.querySelector('main [role="tablist"]')?.closest('nav')?.parentElement;
        if (tabsWrapper && tabsWrapper.nextElementSibling !== toggleButton) tabsWrapper.after(toggleButton);
    }

    let filterActive = false;
    function updateFilterContext() {
        const tabs = Array.from(document.querySelectorAll('main [role="tab"]')).slice(0, 2);
        const selectedTabIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
        const isForYou = isForYouSelection(location.pathname, selectedTabIndex);
        filterActive = filterEnabled && isForYou;
        document.documentElement.classList.toggle(FILTER_ACTIVE_CLASS, filterActive);
        toggleButton.hidden = !isForYou;
    }

    function setFilterEnabled(enabled) {
        filterEnabled = enabled;
        updateFilterContext();
        updateToggleButton();
    }

    toggleButton.addEventListener('click', () => {
        setFilterEnabled(!filterEnabled);
        localStorage.setItem(STORAGE_KEY, String(filterEnabled));
    });
    // Other X tabs follow the toggle; the storage event only fires in tabs that did not make the change.
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) setFilterEnabled(event.newValue !== 'false');
    });
    updateToggleButton();
    ensureToggleButton();
    updateFilterContext();

    // X moves between posts on the j/k keypress and tracks the current post itself,
    // so when it lands on a hidden post, repeat the same keypress instead of moving focus.
    let navCharCode = 0;
    document.addEventListener('keydown', (event) => {
        navCharCode = 0;
        if (event.key !== 'Tab' || !filterActive) return;

        // Tab would stop on collapsed posts, but X's J/K refuse to move onto a post with tabindex -1,
        // so they leave the tab order only while this Tab press moves focus.
        const collapsedPosts = document.querySelectorAll(`${POST_SELECTOR}[${HIDDEN_ATTR}]`);
        for (const post of collapsedPosts) post.tabIndex = -1;
        setTimeout(() => {
            for (const post of collapsedPosts) post.tabIndex = 0;
        });
    }, true);
    document.addEventListener('keypress', (event) => {
        navCharCode = event.charCode === J_CHAR_CODE || event.charCode === K_CHAR_CODE ? event.charCode : 0;
    }, true);
    document.addEventListener('focusin', (event) => {
        const post = event.target;
        if (!navCharCode
            || !filterActive
            || !post.matches(`${POST_SELECTOR}[${HIDDEN_ATTR}]`)) return;

        const charCode = navCharCode;
        setTimeout(() => {
            if (document.activeElement !== post) return;
            post.dispatchEvent(new KeyboardEvent('keypress', {
                key: String.fromCharCode(charCode),
                charCode,
                keyCode: charCode,
                which: charCode,
                bubbles: true,
                cancelable: true
            }));
        });
    });

    const pendingPosts = new Set();
    const videoEmbedPostIds = new Set();
    let flushQueued = false;

    function flush() {
        flushQueued = false;
        for (const post of pendingPosts) {
            post.toggleAttribute(HIDDEN_ATTR, shouldHidePost(classifyPost(post), videoEmbedPostIds));
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
        ensureToggleButton();
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
