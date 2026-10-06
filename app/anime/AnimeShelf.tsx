"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Clapperboard, LayoutGrid, List, Search, Shuffle, Sparkles, Star } from "lucide-react";
import { animeRecommendations, type AnimeRecommendation } from "@/data/anime-recommendations";
import { useTranslation } from "@/lib/i18n";
import styles from "./anime.module.css";

const genres = Array.from(new Set(animeRecommendations.flatMap(item => item.genres)));
const pageSize = 8;

function AnimeRating({ rating }: { rating: AnimeRecommendation["rating"] }) {
  if (!rating) return null;
  return <a className={styles.rating} href={rating.url} target="_blank" rel="noopener noreferrer" title={`${rating.source} · ${rating.checkedAt}`}>
    <Star size={14} aria-hidden="true" /><strong>{rating.score.toFixed(1)}</strong><span>/ 10 · {rating.source}</span><ArrowUpRight size={12} />
  </a>;
}

export default function AnimeShelf() {
  const { tx, language } = useTranslation();
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featured = animeRecommendations[featuredIndex];
  const filtered = animeRecommendations.filter(item =>
    (!genre || item.genres.includes(genre)) &&
    [item.title, item.originalTitle, item.studio, ...item.genres].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageLabel = (value: number) => language === "zh" ? `第 ${value} 页` : language === "en" ? `Page ${value}` : `${value}ページ`;

  return <div id="page-content" className={styles.shelf}>
    {featured && <section className={styles.spotlight} aria-label={tx("今晚看什么")}>
      <div className={styles.featureCopy}>
        <span className={styles.kicker}><Sparkles size={16} /> {tx("今晚看什么")}</span>
        <h2>{tx("从一个故事，")}<br />{tx("走进另一种日常。")}</h2>
        <div className={styles.featureTitle}><span>{String(featuredIndex + 1).padStart(2, "0")}</span><h3>{featured.title}</h3></div>
        <p className={styles.reason}>{featured.whyWatch}</p>
        <div className={styles.meta}>{featured.year} · {featured.studio} · {featured.episodes}</div>
        <AnimeRating rating={featured.rating} />
        <div className={styles.actions}>
          <a href={featured.officialUrl} target="_blank" rel="noopener noreferrer" className={styles.primary}>{tx("了解这部作品")}<ArrowUpRight size={17} /></a>
          <button type="button" onClick={() => setFeaturedIndex(index => (index + 1) % animeRecommendations.length)}><Shuffle size={16} />{tx("换一部")}</button>
        </div>
      </div>
      <div className={styles.featureArt}>
        <span className={styles.orbit} aria-hidden="true" />
        <Image key={featured.id} src={featured.cover} alt={featured.title} width={600} height={900} sizes="(max-width: 700px) 60vw, 300px" className={styles.featurePoster} />
        <span className={styles.artCaption}>{featured.originalTitle}</span>
      </div>
    </section>}

    <section aria-labelledby="anime-shelf-heading" className={styles.collection}>
      <div className={styles.heading}>
        <div><span className={styles.kicker}><Clapperboard size={16} /> {tx("动画片单")}</span><h2 id="anime-shelf-heading">{tx("慢慢挑，慢慢看。")}</h2></div>
        <div className={styles.searchTools}>
          <label className={styles.search}><Search size={24} strokeWidth={2.5} aria-hidden="true" /><span className="sr-only">{tx("搜索番剧")}</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={tx("片名、题材或制作公司")} /></label>
          <div className={styles.viewToggle} role="group" aria-label={tx("布局")}>
            <button type="button" aria-label={tx("网格")} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={17} aria-hidden="true" /><span>{tx("网格")}</span></button>
            <button type="button" aria-label={tx("列表")} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} aria-hidden="true" /><span>{tx("列表")}</span></button>
          </div>
        </div>
      </div>
      <div className={styles.filters} role="group" aria-label={tx("按题材筛选")}>
        <button type="button" aria-pressed={!genre} onClick={() => { setGenre(""); setPage(1); }}>{tx("全部")}<span>{animeRecommendations.length}</span></button>
        {genres.map(value => <button type="button" key={value} aria-pressed={genre === value} onClick={() => { setGenre(value); setPage(1); }}>{tx(value)}</button>)}
      </div>
      <p className={styles.result} role="status">{tx("找到 {n} 部作品", { n: filtered.length })}</p>
      <div className={`${styles.grid} ${view === "list" ? styles.list : ""}`}>
        {visible.map(item => <article key={item.id} className={styles.card}>
          <a href={item.officialUrl} target="_blank" rel="noopener noreferrer" className={styles.posterLink} aria-label={`${tx("了解这部作品")}：${item.title}`}>
            <Image src={item.cover} alt={item.title} width={400} height={600} sizes={view === "list" ? "(max-width: 750px) 30vw, 200px" : "(max-width: 520px) 85vw, (max-width: 900px) 45vw, 25vw"} className={styles.poster} />
            <span className={styles.year}>{item.year}</span><span className={styles.posterAction}><ArrowUpRight size={20} /></span>
          </a>
          <div className={styles.cardCopy}>
            <div className={styles.tags}>{item.genres.map(tag => <span key={tag}>{tx(tag)}</span>)}</div>
            <h3>{item.title}</h3><p className={styles.original}>{item.originalTitle}</p>
            <AnimeRating rating={item.rating} />
            <p className={styles.cardMeta}>{item.studio} · {item.episodes}</p>
            <p className={styles.description}>{item.description}</p>
            <div className={styles.watchReason}><Sparkles size={14} /><p>{item.whyWatch}</p></div>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.source}>{tx("作品资料")}<ArrowUpRight size={13} /></a>
          </div>
        </article>)}
      </div>
      {filtered.length > 0 && <nav className={styles.pagination} aria-label={tx("番剧推荐")}>
        <span>{pageLabel(currentPage)} / {totalPages}</span>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{tx("上一页")}</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(value => <button key={value} type="button" aria-label={pageLabel(value)} aria-current={value === currentPage ? "page" : undefined} onClick={() => setPage(value)}>{value}</button>)}
        <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>{tx("下一页")}</button>
      </nav>}
      {filtered.length === 0 && <div className={styles.empty}><Clapperboard size={32} /><p>{tx("没有找到匹配的番剧，换个关键词试试。")}</p><button type="button" onClick={() => {setQuery("");setGenre("");}}>{tx("查看全部作品")}</button></div>}
    </section>
    <p className={styles.footnote}>{tx("片单参考官方作品资料整理，点击作品可在新标签页查看官网。")}<br />
      {tx("评分为平台用户评分，点击分数查看来源；查询日期：{date}。", { date: Array.from(new Set(animeRecommendations.flatMap(item => item.rating ? [item.rating.checkedAt] : []))).join(" / ") })}
    </p>
  </div>;
}
