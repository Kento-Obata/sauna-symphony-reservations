import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StatusTicketProps {
  state: "pending" | "done";
  latin: string;
  title: ReactNode;
  lead?: ReactNode;
  code: string;
  children?: ReactNode;
  actions?: ReactNode;
}

// 予約完了・仮予約などの「控え」。コードをいちばん目立たせ、コピーできるようにする
export const StatusTicket = ({ state, latin, title, lead, code, children, actions }: StatusTicketProps) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("予約コードをコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  return (
    <div className="u-container flex justify-center py-12 md:py-20">
      <div className="w-full max-w-xl" style={{ animation: "u-fade-up 1s var(--u-ease) both" }}>
        <div className="flex flex-col items-center text-center">
          <span className="relative flex h-20 w-20 items-center justify-center">
            {/* 確定は銅色、仮は輪郭だけ */}
            <span
              className={cn(
                "absolute inset-0 rounded-full",
                state === "done" ? "bg-u-ink" : "border border-dashed border-u-ink/40"
              )}
              style={{ animation: "u-pop .8s var(--u-ease) .1s both" }}
            />
            <span
              className={cn("u-mark relative w-9", state === "done" ? "text-u-green" : "text-u-ink")}
              style={{ animation: "u-rise 1.2s var(--u-ease) .3s both" }}
              aria-hidden
            />
          </span>
          <p className="u-latin mt-6 text-xl italic text-u-ink/80">{latin}</p>
          <h1 className="u-display mt-2 text-[clamp(1.5rem,4vw,2.25rem)] leading-[1.5] tracking-[0.1em]">{title}</h1>
          {lead && <p className="mt-4 max-w-md text-sm leading-[2] text-u-ink/80">{lead}</p>}
        </div>

        <div className="mt-10 overflow-hidden rounded-[1.75rem] bg-u-paper shadow-[0_40px_80px_-50px_rgba(35,31,32,0.5)]">
          <div className="flex items-center justify-between gap-4 bg-u-ink px-6 py-6 text-u-paper sm:px-8">
            <div>
              <p className="text-[0.6875rem] tracking-[0.24em] text-u-paper/55">予約コード</p>
              <p className="u-num mt-1 break-all text-[clamp(1.75rem,6vw,2.5rem)] font-light leading-none tracking-[0.08em]">{code}</p>
            </div>
            <button
              type="button"
              onClick={copy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-u-paper/25 transition-colors hover:bg-u-paper hover:text-u-ink"
              aria-label="予約コードをコピー"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </div>
          <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
        </div>

        {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>}
      </div>
    </div>
  );
};

export const TicketRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-u-ink/10 py-3 text-sm last:border-b-0">
    <span className="text-xs tracking-[0.14em] text-u-ink/65">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

export const TicketNote = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" }) => (
  <div
    className={cn(
      "mt-5 rounded-2xl p-4 text-xs leading-[1.9]",
      tone === "warn" ? "border border-u-amber/40 bg-u-amber/[0.08] text-u-ink/80" : "bg-u-ink/[0.04] text-u-ink/70"
    )}
  >
    {children}
  </div>
);
