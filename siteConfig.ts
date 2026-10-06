// Template defaults. Personal content belongs in your local configuration and database.
export const retiredHeroImages: string[] = [];
export const siteConfig = {
  title: "时光博客", url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  authorName: "博客作者", bio: "记录与分享。", heroSubtitles: ["记录与分享。"],
  avatarUrl: "/images/avatar.png", avatarVideo: "", avatarSource: "",
  heroImage: "/images/cover.webp", heroImages: ["/images/cover.webp"],
  heroImageLibrary: [{ url: "/images/cover.webp", name: "默认封面", category: "covers" }],
  useGradient: false, themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"],
  bgImages: ["/images/cover.webp"], defaultPostCover: "/images/cover.webp", photoWallImage: "/images/cover.webp",
  cloudMusicPlaylistId: "", cloudMusicIds: [] as string[], apiBaseUrl: "", repositoryUrl: process.env.NEXT_PUBLIC_SOURCE_REPOSITORY_URL ?? "https://github.com/EEAA-us/shiguang-blog-source",
  initialAppearance: {
    heroMode: "fixed" as "fixed" | "animated" | "slideshow",
    heroMediaKind: "video" as "video" | "gif", heroMediaUrl: "",
    live2dCharacter: "off" as "firefly" | "furina" | "cyrene" | "march7thQ" | "silverwolf" | "herta" | "off",
  },
  social: { github: "", gitee: "", google: "", email: "", qq: "", wechat: "" },
  buildDate: "2026-10-06T00:00:00+08:00",
  footerBadges: [{ name: "Next.js 16", color: "text-sky-500" }, { name: "React 19", color: "text-cyan-400" }, { name: "Tailwind 4", color: "text-teal-400" }],
  icpConfig: { name: "", link: "" }, moeIcpConfig: { name: "", link: "" },
  chatterTitle: "随想", chatterDescription: "碎片记录",
};
