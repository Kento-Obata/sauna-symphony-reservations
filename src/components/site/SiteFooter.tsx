import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { INSTAGRAM_URL } from "./SiteNav";

export const SiteFooter = ({ minimal = false }: { minimal?: boolean }) => (
  <footer className="relative overflow-hidden bg-u-ink text-u-paper">
    <div className={minimal ? "u-container pb-10 pt-14" : "u-container pb-10 pt-20 md:pt-28"}>
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <span className="u-mark w-14 text-u-mist" aria-hidden />
          {!minimal && (
            <>
          <p className="u-display mt-8 text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.6] tracking-[0.1em]">
            圧倒的な
            <br />
            蒸気浴体験を
          </p>
          <Link to="/#reserve" className="u-btn u-btn-light mt-8">
            貸切サウナ予約
          </Link>
            </>
          )}
        </div>
        <nav className="grid grid-cols-2 gap-8 text-sm md:col-span-6" aria-label="フッター">
          <ul className="space-y-3">
            <li className="u-latin mb-4 text-xs italic text-u-paper/60">Menu</li>
            <li><Link to="/#reserve" className="u-link">ご予約</Link></li>
            <li><Link to="/kodawari" className="u-link">こだわり</Link></li>
            <li><Link to="/#hours" className="u-link">営業時間・料金</Link></li>
            <li><Link to="/#amenities" className="u-link">設備・アメニティ</Link></li>
            <li><Link to="/#guide" className="u-link">ご利用の流れ</Link></li>
            <li><Link to="/#access" className="u-link">アクセス</Link></li>
            <li><Link to="/events" className="u-link">パブリックイベント</Link></li>
          </ul>
          <ul className="space-y-3">
            <li className="u-latin mb-4 text-xs italic text-u-paper/60">Contact</li>
            <li>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
                <Instagram className="h-4 w-4" strokeWidth={1.5} />
                <span className="u-link">@u__sauna</span>
              </a>
            </li>
            <li className="text-u-paper/60">
              〒811-2127
              <br />
              福岡県糟屋郡宇美町障子岳6-8-4
            </li>
          </ul>
        </nav>
      </div>
    </div>
    {/* 大きなワードマーク(下端を少しだけ切って奥行きを出す) */}
    <div className="u-container select-none" aria-hidden>
      <div
        className={`u-latin -mb-[0.22em] font-light italic leading-[0.8] tracking-[-0.04em] text-u-paper/[0.06] ${
          minimal ? "text-[clamp(4.5rem,15vw,12rem)]" : "text-[clamp(6rem,24vw,22rem)]"
        }`}
      >
        U sauna
      </div>
    </div>
    <div className="relative z-10 border-t border-u-paper/10 bg-u-ink">
      <div className="u-container flex flex-col justify-between gap-2 py-6 text-[0.6875rem] tracking-[0.12em] text-u-paper/60 sm:flex-row">
        <span>体験型サウナU</span>
        <span>© 2024 株式会社sync All rights reserved.</span>
      </div>
    </div>
  </footer>
);
