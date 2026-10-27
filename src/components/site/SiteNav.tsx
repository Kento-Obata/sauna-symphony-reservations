import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { cn } from "@/lib/utils";

export const INSTAGRAM_URL = "https://www.instagram.com/u__sauna/";

const NAV_ITEMS = [
  { href: "/#reserve", latin: "Reserve", label: "ご予約" },
  { href: "/kodawari", latin: "Craft", label: "こだわり" },
  { href: "/#hours", latin: "Hours", label: "営業時間・料金" },
  { href: "/#amenities", latin: "Amenities", label: "アメニティ" },
  { href: "/#guide", latin: "Guide", label: "ご利用の流れ" },
  { href: "/#access", latin: "Access", label: "アクセス" },
  { href: "/events", latin: "Events", label: "イベント" },
];

interface SiteNavProps {
  /** トップ以外のページでは最初から背景を敷く */
  solid?: boolean;
}

export const SiteNav = ({ solid = false }: SiteNavProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filled = solid || scrolled;

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500",
          filled && !open && "bg-u-sage/80 shadow-[0_1px_0_rgba(27,28,25,0.1)] backdrop-blur-xl backdrop-saturate-150"
        )}
      >
        <div className="u-container flex h-16 items-center justify-between md:h-[4.5rem]">
          <Link to="/" className="group flex items-center" aria-label="U sauna トップへ" onClick={() => setOpen(false)}>
            <span className="u-mark w-7 text-u-ink transition-transform duration-700 group-hover:-translate-y-0.5" aria-hidden />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="メイン">
            {NAV_ITEMS.slice(1).map((item) => (
              <Link key={item.href} to={item.href} className="group relative text-[0.8125rem] tracking-[0.14em]">
                {item.label}
                <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-u-ink/10 sm:flex"
              aria-label="Instagram（@u__sauna）"
            >
              <Instagram className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </a>
            <Link to="/#reserve" className="u-btn u-btn-primary !min-h-[2.5rem] !px-5 !text-[0.75rem]" onClick={() => setOpen(false)}>
              予約する
            </Link>
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
              aria-label={open ? "メニューを閉じる" : "メニューを開く"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span
                className={cn(
                  "absolute h-px w-5 bg-u-ink transition-transform duration-500",
                  open ? "rotate-45" : "-translate-y-[4px]"
                )}
              />
              <span
                className={cn(
                  "absolute h-px w-5 bg-u-ink transition-transform duration-500",
                  open ? "-rotate-45" : "translate-y-[4px]"
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* モバイル: 全画面メニュー */}
      <div
        className={cn(
          "fixed inset-0 z-[45] bg-u-sage transition-[clip-path] duration-700 [transition-timing-function:var(--u-ease)] lg:hidden",
          open ? "[clip-path:inset(0_0_0_0)]" : "pointer-events-none [clip-path:inset(0_0_100%_0)]"
        )}
        aria-hidden={!open}
      >
        <nav className="u-container flex h-full flex-col justify-between pb-10 pt-28" aria-label="モバイル">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item, i) => {
              const inner = (
                <span className="flex items-baseline justify-between border-b border-u-ink/15 py-4">
                  <span className="u-mincho text-2xl tracking-[0.1em]">{item.label}</span>
                  <span className="u-latin text-lg italic text-u-ink/80">{item.latin}</span>
                </span>
              );
              return (
                <li
                  key={item.href}
                  className={cn("transition-all duration-700", open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
                  style={{ transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }}
                >
                  <Link to={item.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-end justify-between">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm"
              tabIndex={open ? 0 : -1}
            >
              <Instagram className="h-4 w-4" strokeWidth={1.5} /> @u__sauna
            </a>
            <span className="u-mark w-14 text-u-ink/20" aria-hidden />
          </div>
        </nav>
      </div>
    </>
  );
};
