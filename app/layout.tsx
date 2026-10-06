import type { Metadata } from "next";
import "./globals.css";
import "./template-fonts.css";
import "./appearance.css";
import "highlight.js/styles/vs2015.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { BackgroundProvider } from "@/components/providers/BackgroundProvider";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";
import { CoverMediaProvider } from "@/components/providers/CoverMediaProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { EffectProvider } from "@/components/providers/EffectProvider";
import BackgroundRenderer from "@/components/layout/BackgroundRenderer";
import Navbar from "@/components/layout/Navbar";
import ClientWidgets from "@/components/layout/ClientWidgets";
import DecorativeEffects from "@/components/layout/DecorativeEffects";
import WelcomeScreen from "@/components/layout/WelcomeScreen";
import VisitorTracker from "@/components/layout/VisitorTracker";
import { siteConfig } from "@/siteConfig";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.bio,
  icons: { icon: [{ url: "/icon", type: "image/png", sizes: "64x64" }], apple: "/icon" },
  alternates: {
    types: {
      "application/rss+xml": "/feed",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <EffectProvider>
            <BackgroundProvider>
              <AppearanceProvider>
                <CoverMediaProvider>
                <WelcomeScreen />
                <MusicProvider>
                  <ToastProvider>
                    <BackgroundRenderer />
                    <VisitorTracker />
                    <DecorativeEffects />
                    <Navbar />
                    <main className="flex-1 pt-16">
                      {children}
                    </main>
                    <ClientWidgets />
                  </ToastProvider>
                </MusicProvider>
                </CoverMediaProvider>
              </AppearanceProvider>
            </BackgroundProvider>
          </EffectProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
