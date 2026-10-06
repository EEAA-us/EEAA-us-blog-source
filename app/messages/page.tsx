import { Newspaper } from "lucide-react";

export default function MessagesPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
      <div className="glass-card rounded-3xl p-10 text-center">
        <Newspaper className="w-10 h-10 mx-auto mb-4 text-sky-500" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">留言功能未开放</h1>
        <p className="text-slate-500 dark:text-slate-400 leading-7">这个博客目前只用于个人记录，访客可以阅读内容，但不开放留言、评论和投稿。</p>
      </div>
    </main>
  );
}
