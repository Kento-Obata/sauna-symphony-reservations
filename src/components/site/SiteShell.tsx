import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import { cn } from "@/lib/utils";
import { useHashScroll } from "@/hooks/useHashScroll";

interface SiteShellProps {
  children: ReactNode;
  className?: string;
  /** フッターの大きな CTA を省く(完了ページ等) */
  minimalFooter?: boolean;
}

// トップ以外の顧客向けページの共通レイアウト
export const SiteShell = ({ children, className, minimalFooter }: SiteShellProps) => {
  useHashScroll();
  return (
    <div className="u-site u-grain flex min-h-screen flex-col">
      <SiteNav solid />
      <main className={cn("flex-1 pt-16 md:pt-[4.5rem]", className)}>{children}</main>
      <SiteFooter minimal={minimalFooter} />
    </div>
  );
};

interface PageHeroProps {
  latin: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}

export const PageHero = ({ latin, title, lead, children }: PageHeroProps) => (
  <header className="u-container pb-10 pt-14 md:pb-16 md:pt-24">
    <p className="u-latin text-[clamp(2.5rem,7vw,5rem)] font-light italic leading-none tracking-tight" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
      {latin}
    </p>
    <h1
      className="u-display mt-5 text-[clamp(1.375rem,2.6vw,2rem)] leading-[1.6] tracking-[0.1em]"
      style={{ animation: "u-fade-up 1s var(--u-ease) .1s both" }}
    >
      {title}
    </h1>
    {lead && (
      <p className="mt-4 max-w-xl text-[0.9375rem] leading-[2] text-u-ink/80" style={{ animation: "u-fade-up 1s var(--u-ease) .2s both" }}>
        {lead}
      </p>
    )}
    {children}
  </header>
);
