import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  index: string;
  latin: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  tone?: "dark" | "light";
}

// 「01 — Reserve」+ 明朝の見出し。番号はセクションの並びと一致させる
export const SectionHeading = ({ index, latin, title, lead, className, tone = "dark" }: SectionHeadingProps) => (
  <header className={cn("grid gap-6 md:grid-cols-12 md:gap-8", className)}>
    <Reveal className="md:col-span-4">
      <div className={cn("flex items-baseline gap-4", tone === "light" ? "text-u-paper" : "")}>
        <span className="u-num text-sm opacity-60">{index}</span>
        <span className="u-latin text-[clamp(2.5rem,6vw,4.5rem)] font-light italic leading-none tracking-tight">
          {latin}
        </span>
      </div>
    </Reveal>
    <div className="md:col-span-8 md:pt-3">
      <Reveal delay={120}>
        <h2
          className={cn(
            "u-mincho text-[clamp(1.375rem,2.6vw,2rem)] leading-[1.6] tracking-[0.08em]",
            tone === "light" ? "text-u-paper" : ""
          )}
        >
          {title}
        </h2>
      </Reveal>
      {lead && (
        <Reveal delay={220}>
          <p
            className={cn(
              "mt-4 max-w-xl text-[0.9375rem] leading-[2]",
              tone === "light" ? "text-u-paper/70" : "text-u-ink/80"
            )}
          >
            {lead}
          </p>
        </Reveal>
      )}
    </div>
  </header>
);
