import type { Root, RootContent } from "hast";

/** Keep the blog open when readers follow sources in rendered Markdown. */
export default function rehypeExternalLinks() {
  return (tree: Root) => {
    const visit = (node: Root | RootContent) => {
      if (node.type === "element" && node.tagName === "a" &&
          typeof node.properties.href === "string" && /^https?:\/\//i.test(node.properties.href)) {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
      }
      if ("children" in node) node.children.forEach(visit);
    };
    visit(tree);
  };
}
