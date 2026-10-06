"use client";

import { useMemo } from "react";
import type { ArticleHeading } from "./useArticleHeadings";

type OutlineNode = ArticleHeading & { children: OutlineNode[] };

interface ArticleOutlineProps {
  headings: ArticleHeading[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function ArticleOutline({ headings, activeId, onSelect }: ArticleOutlineProps) {
  const tree = useMemo(() => {
    const roots: OutlineNode[] = [];
    const parents: OutlineNode[] = [];
    for (const heading of headings) {
      const node: OutlineNode = { ...heading, children: [] };
      while (parents.length && parents[parents.length - 1].level >= node.level) parents.pop();
      const parent = parents[parents.length - 1];
      if (parent) parent.children.push(node);
      else roots.push(node);
      parents.push(node);
    }
    return roots;
  }, [headings]);

  const renderBranch = (items: OutlineNode[], nested = false): React.ReactNode => (
    <ul className={nested ? "ml-3 mt-1 border-l-2 border-sky-400/35 dark:border-sky-500/30 pl-3 space-y-1" : "article-outline space-y-1"}>
      {items.map((heading) => (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            aria-current={activeId === heading.id ? "location" : undefined}
            onClick={(event) => { event.preventDefault(); onSelect(heading.id); }}
            className={`relative block w-full rounded-lg px-2.5 py-2 text-left transition-colors select-none cursor-pointer ${activeId === heading.id ? "text-sky-600 dark:text-sky-400 bg-sky-500/15" : "text-slate-500 dark:text-slate-400 hover:text-sky-500 hover:bg-sky-500/10"}`}
          >
            {activeId === heading.id && <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-sky-400" />}
            <span className="block break-words leading-5">{heading.text}</span>
          </a>
          {heading.children.length > 0 && renderBranch(heading.children, true)}
        </li>
      ))}
    </ul>
  );

  return renderBranch(tree);
}
