import test from "node:test";
import assert from "node:assert/strict";
import { renderArticleMarkdown } from "../../lib/article-markdown.ts";
import { findActiveHeading } from "../../lib/article-scroll.ts";

test("sized Markdown images defer downloads; unknown originals and escaped attributes remain compatible", () => {
  const html = renderArticleMarkdown('![a \"quoted\" caption](/diagram.svg "a <title>")\n\n![gif](/animation.gif)\n\n![external](https://example.com/image.png)', {
    '/diagram.svg': { width: 800, height: 600 }, '/animation.gif': { width: 400, height: 300 },
  });
  assert.equal((html.match(/loading="lazy" decoding="async"/g) ?? []).length, 2);
  assert.match(html, /src="\/diagram.svg" alt="a &quot;quoted&quot; caption"/);
  assert.match(html, /title="a &lt;title&gt;"/);
  assert.match(html, /src="\/animation.gif"/);
  assert.match(html, /src="https:\/\/example.com\/image.png"/);
  assert.match(html, /loading="eager" decoding="async" src="https:\/\/example.com\/image.png"/);
});

test("Callout, inline highlight, code and explicit image dimensions retain their reading semantics", () => {
  const html = renderArticleMarkdown('> [!CAUTION] Keep this title\n> Be careful\n\n==**important**==\n\n```c\nint value = 1;\n```\n\n<img src="/raw.png" width="800" height="600" loading="eager">');
  assert.match(html, /<strong>Keep this title<\/strong>/);
  assert.match(html, /<mark><strong>important<\/strong><\/mark>/);
  assert.match(html, /class="language-c"/);
  assert.match(html, /width="800" height="600" loading="eager"/);
});

test("Heading search keeps before-first, exact boundary, duplicate position and final section behavior", () => {
  const positions = [100, 250, 250, 600];
  assert.equal(findActiveHeading([], 1), -1);
  assert.equal(findActiveHeading(positions, 99), -1);
  assert.equal(findActiveHeading(positions, 100), 0);
  assert.equal(findActiveHeading(positions, 250), 2);
  assert.equal(findActiveHeading(positions, 599), 2);
  assert.equal(findActiveHeading(positions, 999), 3);
});

test("known image dimensions reserve layout; invalid or missing metadata never invents a ratio", () => {
  const html = renderArticleMarkdown('![known](/known.png)\n\n![bad](/bad.png)\n\n![external](https://example.com/image.png)', {
    '/known.png': { width: 1200, height: 800 },
    '/bad.png': { width: -1, height: 0 },
  });
  assert.match(html, /width="1200" height="800" src="\/known.png"/);
  assert.equal((html.match(/ width=/g) ?? []).length, 1);
});

test("Large article heading lookup reads logarithmically rather than rescanning all titles", () => {
  let reads = 0;
  const positions = new Proxy(Array.from({ length: 10_000 }, (_, index) => index * 20), {
    get(target, key, receiver) {
      if (/^\d+$/.test(String(key))) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  assert.equal(findActiveHeading(positions, 123_456), 6172);
  assert.ok(reads <= 14, `read ${reads} heading positions`);
});
