import { Marked, Renderer } from "marked";

export type ArticleImageDimensions = Record<string, { width: number; height: number }>;

const articleMarkdown = new Marked({
  extensions: [{
    name: "obsidianHighlight",
    level: "inline",
    start: (source) => {
      const index = source.indexOf("==");
      return index < 0 ? undefined : index;
    },
    tokenizer(source) {
      const match = /^==([^=\n]+)==/.exec(source);
      if (!match) return;
      return { type: "obsidianHighlight", raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(token) {
      return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
    },
  }],
});

export function renderArticleMarkdown(content: string, dimensions: ArticleImageDimensions = {}): string {
  const calloutLabels: Record<string, string> = { NOTE: "说明", CAUTION: "注意", EXAMPLE: "举例" };
  const normalized = content.replace(/^> \[!(NOTE|CAUTION|EXAMPLE)\](?:\s+([^\n]+))?/gm, (_match, type: string, title?: string) => `> **${title?.trim() || calloutLabels[type]}**`);
  const renderer = new Renderer();
  renderer.image = function (token) {
    const size = dimensions[token.href];
    const validSize = size && Number.isSafeInteger(size.width) && size.width > 0
      && Number.isSafeInteger(size.height) && size.height > 0;
    const attributes = validSize ? ` width="${size.width}" height="${size.height}"` : "";
    // Keep Marked's URL/alt escaping and native originals, including SVG/GIF.
    // Without a known ratio, retain eager loading rather than collapsing the
    // layout of existing local API content or arbitrary external images.
    return Renderer.prototype.image.call(this, token)
      .replace("<img ", `<img loading="${validSize ? "lazy" : "eager"}" decoding="async"${attributes} `);
  };
  return articleMarkdown.parse(normalized, { async: false, renderer });
}
