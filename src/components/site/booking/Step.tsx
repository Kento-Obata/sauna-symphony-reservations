import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProps {
  id: string;
  index: number;
  title: string;
  hint?: ReactNode;
  done?: boolean;
  optional?: boolean;
  children: ReactNode;
}

export const Step = ({ id, index, title, hint, done, optional, children }: StepProps) => (
  <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 border-t border-u-ink/10 pb-8 pt-7 first:border-t-0 first:pt-0 last:pb-0 sm:pb-10 sm:pt-9">
    <div className="mb-5 flex items-center gap-4">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition-all duration-500",
            done ? "border-u-ink bg-u-ink text-u-paper" : "border-u-ink/25 text-u-ink/70"
          )}
          aria-hidden
        >
          {done ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2} style={{ animation: "u-pop .4s var(--u-ease) both" }} />
          ) : (
            <span className="u-num text-sm">{index}</span>
          )}
        </span>
        <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id={`${id}-title`} className="u-display text-lg tracking-[0.12em] sm:text-xl">
            {title}
            {optional && <span className="ml-2 align-middle text-[0.6875rem] font-normal tracking-[0.16em] text-u-ink/65">任意</span>}
          </h3>
          {hint && <span className="text-xs text-u-ink/65">{hint}</span>}
        </div>
    </div>
    {children}
  </section>
);
