'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
    statusIdFromHref,
    authorFromStatusHref,
    isQuotePost,
    isForYouSelection
} = require('./x-hide-quote-posts.user.js');

const userscriptSource = readFileSync(require.resolve('./x-hide-quote-posts.user.js'), 'utf8');

function link(href, insideVideo = false) {
    return {
        getAttribute: (name) => name === 'href' ? href : null,
        closest: (selector) => insideVideo && selector.includes('videoComponent') ? {} : null
    };
}

function avatar(author) {
    return { getAttribute: (name) => name === 'data-testid' ? `UserAvatar-Container-${author}` : null };
}

function quoteCard(author, hasVideo) {
    return {
        querySelector: (selector) => selector.includes('UserAvatar-Container')
            ? avatar(author)
            : hasVideo ? {} : null
    };
}

function post({
    outerHref,
    hrefs = [],
    quotedAuthors = [],
    quotedVideo = false,
    embeddedVideoHref = null,
    outerAvatarAuthor = null
}) {
    return {
        querySelector: (selector) => {
            if (selector === 'time' && outerHref) return { closest: () => link(outerHref) };
            if (selector.startsWith('[data-testid="Tweet-User-Avatar"]') && outerAvatarAuthor) {
                return avatar(outerAvatarAuthor);
            }
            return null;
        },
        querySelectorAll: (selector) => selector.startsWith('a[href')
            ? hrefs.map((href) => link(href, href === embeddedVideoHref))
            : quotedAuthors.map((author) => quoteCard(author, quotedVideo))
    };
}

test('extracts post IDs from relative and absolute status URLs', () => {
    assert.equal(statusIdFromHref('/user/status/12345/photo/1'), '12345');
    assert.equal(statusIdFromHref('https://x.com/user/status/67890'), '67890');
    assert.equal(statusIdFromHref('/user/likes'), null);
    assert.equal(authorFromStatusHref('/SomeUser/status/12345'), 'someuser');
    assert.equal(authorFromStatusHref('/i/web/status/12345'), null);
});

test('keeps an original post whose links all belong to that post', () => {
    const original = post({
        outerHref: '/author/status/111',
        hrefs: [
            '/author/status/111',
            '/author/status/111/photo/1',
            '/author/status/111/analytics'
        ]
    });

    assert.equal(isQuotePost(original), false);
});

test('hides a cross-author quote that has a status link', () => {
    const quote = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111', '/quoted/status/222']
    });

    assert.equal(isQuotePost(quote), true);
});

test('hides a cross-author quote card that has no status link', () => {
    const quote = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111'],
        quotedAuthors: ['quoted']
    });

    assert.equal(isQuotePost(quote), true);
});

test('keeps a self-quote card visible', () => {
    const selfQuote = post({
        outerHref: '/Author/status/111',
        hrefs: ['/Author/status/111'],
        quotedAuthors: ['author']
    });

    assert.equal(isQuotePost(selfQuote), false);
});

test('keeps a self-quote that uses status links visible', () => {
    const selfQuote = post({
        outerHref: '/author/status/111',
        hrefs: ['/author/status/111', '/author/status/222']
    });

    assert.equal(isQuotePost(selfQuote), false);
});

test('hides a normal quote card that contains a video', () => {
    const videoQuote = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111'],
        quotedAuthors: ['videoauthor'],
        quotedVideo: true
    });

    assert.equal(isQuotePost(videoQuote), true);
});

test('keeps a direct video embed exempt after hover replaces its video DOM', () => {
    const videoExemptPostIds = new Set();
    const embeddedVideoHref = '/i/status/222';
    const idleVideoEmbed = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111', embeddedVideoHref],
        embeddedVideoHref
    });
    const hoveredVideoEmbed = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111', embeddedVideoHref]
    });

    assert.equal(isQuotePost(idleVideoEmbed, videoExemptPostIds), false);
    assert.deepEqual([...videoExemptPostIds], ['111']);
    assert.equal(isQuotePost(hoveredVideoEmbed, videoExemptPostIds), false);
});

test('keeps a quoted video status link visible', () => {
    const videoQuote = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111', '/videoauthor/status/222/video/1']
    });

    assert.equal(isQuotePost(videoQuote), false);
});

test('keeps a generic quoted status link inside an embedded-video player visible', () => {
    const embeddedVideoHref = '/i/status/222';
    const videoQuote = post({
        outerHref: '/commenter/status/111',
        hrefs: ['/commenter/status/111', embeddedVideoHref],
        embeddedVideoHref
    });

    assert.equal(isQuotePost(videoQuote), false);
});

test('waits for the outer post permalink before deciding', () => {
    assert.equal(isQuotePost(post({
        outerHref: null,
        hrefs: ['/quoted/status/222'],
        quotedAuthors: ['quoted']
    })), false);
});

test('uses one consistent compact height in both scroll directions', () => {
    assert.match(
        userscriptSource,
        /html\.\$\{FILTER_ACTIVE_CLASS\} \.\$\{HIDDEN_CLASS\} \{[\s\S]*?height: 52px !important;/
    );
    assert.doesNotMatch(
        userscriptSource,
        /html\.\$\{FILTER_ACTIVE_CLASS\} \.\$\{HIDDEN_CLASS\} \{ display: none/
    );
    assert.doesNotMatch(userscriptSource, /window\.scroll(?:To|By)\(/);
});

test('lets the hidden attribute override the toggle display style', () => {
    assert.match(userscriptSource, /#\$\{TOGGLE_ID\}\[hidden\] \{ display: none; \}/);
});

test('activates filtering only for the first Home feed tab', () => {
    assert.equal(isForYouSelection('/home', 0), true);
    assert.equal(isForYouSelection('/home', 1), false);
    assert.equal(isForYouSelection('/profile', 0), false);
});
