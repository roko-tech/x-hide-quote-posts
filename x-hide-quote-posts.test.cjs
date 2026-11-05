'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const {
    statusIdFromHref,
    authorFromStatusHref,
    classifyPost,
    shouldHidePost,
    isForYouSelection,
    pruneSeenPosts,
    parseSeenPosts,
    timelinePostIds,
    WHO_TO_FOLLOW_ROW_SELECTOR,
    SEEN_ROW_SELECTOR
} = require('./x-hide-quote-posts.user.js');

const userscriptSource = readFileSync(require.resolve('./x-hide-quote-posts.user.js'), 'utf8');

function parsePost(html) {
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
    return document.querySelector('article[data-testid="tweet"]');
}

function fixture(name) {
    return parsePost(readFileSync(path.join(__dirname, 'fixtures', `${name}.html`), 'utf8'));
}

// An original post by alice with extra markup appended, for link-only cases not seen live.
function originalWith(extraHtml) {
    const html = readFileSync(path.join(__dirname, 'fixtures', 'original.html'), 'utf8');
    return parsePost(html.replace('</article>', `${extraHtml}</article>`));
}

test('extracts post IDs from relative and absolute status URLs', () => {
    assert.equal(statusIdFromHref('/user/status/12345/photo/1'), '12345');
    assert.equal(statusIdFromHref('https://x.com/user/status/67890'), '67890');
    assert.equal(statusIdFromHref('/user/likes'), null);
    assert.equal(authorFromStatusHref('/SomeUser/status/12345'), 'someuser');
    assert.equal(authorFromStatusHref('/i/web/status/12345'), null);
});

test('keeps an original post whose links all belong to that post', () => {
    assert.deepEqual(classifyPost(fixture('original')), { postId: '1000', kind: 'original' });
});

test('hides a cross-author quote card', () => {
    assert.equal(classifyPost(fixture('cross-quote')).kind, 'quote');
});

test('hides a quote card that contains a video', () => {
    assert.equal(classifyPost(fixture('video-quote')).kind, 'quote');
});

test('hides a quote of a post that itself quotes someone else', () => {
    assert.equal(classifyPost(fixture('nested-quote')).kind, 'quote');
});

test('keeps self-quotes visible, with or without media', () => {
    assert.equal(classifyPost(fixture('self-quote')).kind, 'self-quote');
    assert.equal(classifyPost(fixture('self-quote-with-media')).kind, 'self-quote');
});

test('ignores the nested quote inside a self-quote', () => {
    assert.equal(classifyPost(fixture('nested-self-quote')).kind, 'self-quote');
});

test('treats a plain video without a foreign status link as an original post', () => {
    assert.equal(classifyPost(fixture('video-embed')).kind, 'original');
});

test('treats a status link inside the video player as a direct video embed', () => {
    assert.equal(classifyPost(fixture('video-embed-status-link')).kind, 'video-embed');
});

test('keeps a direct video embed visible after hover replaces its player DOM', () => {
    const videoEmbedPostIds = new Set();
    const idle = classifyPost(fixture('video-embed-status-link'));
    const hovered = classifyPost(fixture('video-embed-hovered'));

    assert.equal(shouldHidePost(idle, videoEmbedPostIds), false);
    assert.deepEqual([...videoEmbedPostIds], ['1000']);
    assert.equal(hovered.kind, 'quote');
    assert.equal(shouldHidePost(hovered, videoEmbedPostIds), false);
});

test('classifies link-only quotes by the linked author', () => {
    assert.equal(classifyPost(originalWith('<a href="/bob/status/2000"></a>')).kind, 'quote');
    assert.equal(classifyPost(originalWith('<a href="/alice/status/2000"></a>')).kind, 'self-quote');
    assert.equal(classifyPost(originalWith('<a href="/bob/status/2000/video/1"></a>')).kind, 'video-embed');
});

test('waits for the post permalink before deciding', () => {
    assert.deepEqual(classifyPost(fixture('pending')), { postId: null, kind: 'pending' });
});

test('hides only cross-author quotes', () => {
    for (const kind of ['pending', 'original', 'self-quote', 'video-embed']) {
        assert.equal(shouldHidePost({ postId: '1', kind }, new Set()), false, kind);
    }
    assert.equal(shouldHidePost({ postId: '1', kind: 'quote' }, new Set()), true);
});

test('hides only the heading and account rows of a feed "Who to follow" block', () => {
    const html = readFileSync(path.join(__dirname, 'fixtures', 'who-to-follow.html'), 'utf8');
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
    const hiddenRows = [...document.querySelectorAll(WHO_TO_FOLLOW_ROW_SELECTOR)].map((row) => row.id);

    assert.deepEqual(hiddenRows, ['heading', 'account-1', 'account-2', 'account-3']);
});

test('leaves account rows outside the timeline column alone', () => {
    const { document } = parseHTML('<!doctype html><html><body><div data-testid="sidebarColumn">'
        + '<div data-testid="cellInnerDiv"><h2 role="heading"></h2></div>'
        + '<div data-testid="cellInnerDiv"><button data-testid="UserCell"></button></div>'
        + '</div></body></html>');

    assert.equal(document.querySelectorAll(WHO_TO_FOLLOW_ROW_SELECTOR).length, 0);
});

test('collapses "Who to follow" and seen rows only on the Home feed, keeping them focusable for J/K', () => {
    assert.match(
        userscriptSource,
        /COLLAPSED_ROW_SELECTOR = `html\.\$\{HOME_FEED_CLASS\} \$\{WHO_TO_FOLLOW_ROW_SELECTOR\}, html\.\$\{SEEN_ACTIVE_CLASS\} \$\{SEEN_ROW_SELECTOR\}`/
    );
    assert.match(userscriptSource, /\$\{COLLAPSED_ROW_SELECTOR\} \{\s*height: 0 !important;\s*overflow: hidden !important;/);
    assert.doesNotMatch(userscriptSource, /ROW_SELECTOR\} \{\s*display: none/);
    assert.match(userscriptSource, /const onHomeFeed = location\.pathname === '\/home';/);
    assert.match(userscriptSource, /seenActive = seenEnabled && onHomeFeed;/);
});

test('matches timeline rows holding a post seen on an earlier visit', () => {
    const { document } = parseHTML('<!doctype html><html><body>'
        + '<div data-testid="primaryColumn">'
        + '<div data-testid="cellInnerDiv" id="seen"><article data-testid="tweet" data-x-hide-quote-posts-seen></article></div>'
        + '<div data-testid="cellInnerDiv" id="new"><article data-testid="tweet"></article></div>'
        + '</div>'
        + '<div data-testid="sidebarColumn"><div data-testid="cellInnerDiv"><article data-x-hide-quote-posts-seen></article></div></div>'
        + '</body></html>');

    assert.deepEqual([...document.querySelectorAll(SEEN_ROW_SELECTOR)].map((row) => row.id), ['seen']);
});

test('keeps seen posts for 7 days and at most 5000, newest first', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    assert.deepEqual(
        pruneSeenPosts({ fresh: now - day, edge: now - 7 * day, old: now - 8 * day, bad: 'x' }, now),
        { fresh: now - day }
    );

    const many = Object.fromEntries(Array.from({ length: 5002 }, (_, i) => [`p${i}`, now - i]));
    const kept = pruneSeenPosts(many, now);
    assert.equal(Object.keys(kept).length, 5000);
    assert.ok(!('p5000' in kept) && !('p5001' in kept));
    assert.ok('p0' in kept);
});

test('treats a missing or corrupt seen-post list as empty', () => {
    assert.deepEqual(parseSeenPosts(null), {});
    assert.deepEqual(parseSeenPosts('not json'), {});
    assert.deepEqual(parseSeenPosts('[1,2]'), {});
    assert.deepEqual(parseSeenPosts('{"123":5}'), { 123: 5 });
});

test('lists the posts a timeline response shows, counting a repost as the post it shows', () => {
    const response = JSON.parse(readFileSync(path.join(__dirname, 'fixtures', 'home-timeline-page.json'), 'utf8'));

    assert.deepEqual(timelinePostIds(response), ['3001', '3002', '3003', '3005']);
    assert.deepEqual(timelinePostIds({}), []);
});

test('hides a post X sends again only if you already scrolled past it in this visit', () => {
    assert.match(
        userscriptSource,
        /if \(deliveredPosts\.has\(postId\) && Object\.hasOwn\(newlySeenPosts, postId\) && !repeatedPosts\.has\(postId\)\)/
    );
    assert.match(userscriptSource, /seenBeforeLoad\.has\(classification\.postId\)\s*\|\| repeatedPosts\.has\(classification\.postId\)/);
    assert.match(userscriptSource, /\/\\\/\(\?:HomeTimeline\|HomeLatestTimeline\)\\b\//);
});

test('only records posts once they are fully above the screen, and only when the option is on', () => {
    assert.match(userscriptSource, /if \(isIntersecting \|\| boundingClientRect\.bottom > 0\) continue;/);
    assert.match(userscriptSource, /if \(!seenActive \|\| !postId \|\| shownAsPlaceholder/);
    assert.match(userscriptSource, /let seenEnabled = localStorage\.getItem\(SEEN_ENABLED_KEY\) === 'true';/);
});

test('uses one fixed compact height in both scroll directions', () => {
    assert.match(
        userscriptSource,
        /html\.\$\{FILTER_ACTIVE_CLASS\} \[\$\{HIDDEN_ATTR\}\] \{[\s\S]*?height: 20px !important;/
    );
    assert.doesNotMatch(
        userscriptSource,
        /html\.\$\{FILTER_ACTIVE_CLASS\} \[\$\{HIDDEN_ATTR\}\] \{ display: none/
    );
    assert.doesNotMatch(userscriptSource, /window\.scroll(?:To|By)\(/);
});

test('renders the placeholder in X\'s font', () => {
    assert.match(userscriptSource, /\[\$\{HIDDEN_ATTR\}\]::after \{[\s\S]*?font-family: TwitterChirp,/);
});

test('marks hidden posts with an attribute that survives X rewriting the class list', () => {
    assert.doesNotMatch(userscriptSource, /classList\.(?:add|remove|toggle)\(HIDDEN/);
    assert.match(userscriptSource, /post\.toggleAttribute\(HIDDEN_ATTR, /);
});

test('lets the hidden attribute override the toggle display style', () => {
    assert.match(userscriptSource, /\.\$\{BUTTON_CLASS\}\[hidden\] \{ display: none; \}/);
});

test('activates filtering only for the first Home feed tab', () => {
    assert.equal(isForYouSelection('/home', 0), true);
    assert.equal(isForYouSelection('/home', 1), false);
    assert.equal(isForYouSelection('/profile', 0), false);
});
