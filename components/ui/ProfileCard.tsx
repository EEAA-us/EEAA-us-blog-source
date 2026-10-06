"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteConfig } from "@/siteConfig";
import "./profile-card.css";
import AnimatedAvatar from "./AnimatedAvatar";
import RepositoryLink from "./RepositoryLink";
import { useTranslation } from "@/lib/i18n";

export default function ProfileCard() {
  const { tx } = useTranslation();
  return <section className="editorial-panel profile-card">
    <div className="profile-card-avatar">
      <AnimatedAvatar sizes="(min-width: 1280px) 250px, 320px" />
    </div>
    <div className="profile-card-copy">
      <h2>{siteConfig.authorName}</h2><span className="profile-card-divider" aria-hidden="true" />
      <p>{siteConfig.bio}</p>
      <div className="profile-card-links">
        <Link href="/about" className="profile-card-about">{tx("关于这个小站")}<ArrowUpRight size={13} aria-hidden="true" /></Link>
        <RepositoryLink className="profile-card-repository" />
      </div>
      {siteConfig.avatarSource && <a className="profile-card-source" href={siteConfig.avatarSource} target="_blank" rel="noopener noreferrer">{tx("头像素材来源")}</a>}
    </div>
  </section>;
}
