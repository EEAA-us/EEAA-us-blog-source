import type { Metadata } from "next";
import PageCover from "@/components/ui/PageCover";
import AnimeShelf from "./AnimeShelf";

export const metadata: Metadata = {
  title: "番剧推荐 · 拾光手札",
  description: "按题材挑一部喜欢的动画，收集值得慢慢看的故事。",
};

export default function AnimePage() {
  return <>
    <PageCover title="番剧推荐" description="给日常留一集动画的时间" eyebrow="故事 · 画面 · 余韵" />
    <AnimeShelf />
  </>;
}
