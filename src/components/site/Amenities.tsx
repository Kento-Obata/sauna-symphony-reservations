import { useOptions } from "@/hooks/useOptions";
import { formatPrice } from "@/utils/priceCalculations";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const RENTALS = ["水着", "サウナハット", "ポンチョ", "サンダル"];
const AMENITIES = ["シャンプー・リンス", "ボディソープ", "化粧水", "乳液", "洗顔", "フェイスパック", "ヘアオイル", "ボディクリーム", "美容液"];
const FACILITIES = ["カールアイロン", "ストレートアイロン", "ドライヤー"];

const ItemList = ({ items }: { items: string[] }) => (
  <ul className="mt-6">
    {items.map((t, i) => (
      <li key={t} className="flex items-baseline gap-4 border-t border-u-ink/10 py-2.5 text-[0.9375rem] tracking-[0.08em]">
        <span className="u-num w-5 text-xs text-u-ink/65">{String(i + 1).padStart(2, "0")}</span>
        {t}
      </li>
    ))}
  </ul>
);

const Free = () => (
  <span className="rounded-full border border-u-ink/20 px-2.5 py-0.5 text-[0.625rem] tracking-[0.2em] text-u-ink/80">無料</span>
);

export const Amenities = () => {
  // 有料オプションは管理画面の options テーブルから(有効なものだけ)表示する
  const { data: options } = useOptions();
  const paid = options ?? [];

  return (
    <section id="amenities" className="scroll-mt-16 bg-u-paper py-24 md:py-36" aria-labelledby="amenities-title">
      <div className="u-container">
        <SectionHeading
          index="04"
          latin="Amenities"
          title={<span id="amenities-title">設備・アメニティ</span>}
          lead="水着もサウナハットも、すべてこちらでご用意しています。手ぶらでお越しください"
        />

        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-12 md:gap-6">
          {/* 手ぶらOK: いちばん伝えたいことを大きく */}
          <Reveal className="relative flex flex-col overflow-hidden rounded-[1.5rem] bg-u-ink p-7 text-u-paper sm:p-10 md:col-span-6 md:row-span-2">
            <span className="u-mark pointer-events-none absolute -bottom-10 -right-10 w-64 text-u-paper/[0.05]" aria-hidden />
            <div className="relative flex items-baseline justify-between">
              <span className="u-latin text-lg italic text-u-copper">Rental</span>
              <span className="rounded-full bg-u-copper px-3 py-1 text-[0.6875rem] tracking-[0.2em] text-u-ink">無料貸出</span>
            </div>
            <p className="u-latin relative mt-10 text-[clamp(3rem,6.5vw,5.25rem)] font-light italic leading-[0.95] tracking-[-0.01em]">
              All inclusive
            </p>
            <p className="u-mincho relative mt-5 text-[clamp(1.25rem,2.2vw,1.625rem)] leading-[1.6] tracking-[0.1em]">
              手ぶらでお越しください
            </p>
            <ul className="relative mt-10 flex flex-wrap gap-2 md:mt-auto md:pt-10">
              {RENTALS.map((t) => (
                <li key={t} className="rounded-full border border-u-paper/25 px-4 py-2 text-sm tracking-[0.1em]">
                  {t}
                </li>
              ))}
            </ul>
            <p className="relative mt-6 text-xs leading-[1.9] text-u-paper/60">すべて無料でお貸し出しします</p>
          </Reveal>

          <Reveal delay={100} className="rounded-[1.5rem] border border-u-ink/10 bg-white/40 p-7 sm:p-8 md:col-span-3 md:row-span-2">
            <div className="flex items-baseline justify-between">
              <h3 className="u-mincho text-xl tracking-[0.12em]">アメニティ</h3>
              <Free />
            </div>
            <p className="u-latin mt-1 text-sm italic text-u-ink/65">Amenities</p>
            <ItemList items={AMENITIES} />
          </Reveal>

          <Reveal delay={200} className="rounded-[1.5rem] border border-u-ink/10 bg-white/40 p-7 sm:p-8 md:col-span-3 md:row-span-2">
            <div className="flex items-baseline justify-between">
              <h3 className="u-mincho text-xl tracking-[0.12em]">設備</h3>
              <span className="rounded-full border border-u-ink/20 px-2.5 py-0.5 text-[0.625rem] tracking-[0.2em] text-u-ink/80">完備</span>
            </div>
            <p className="u-latin mt-1 text-sm italic text-u-ink/65">Facilities</p>
            <ItemList items={FACILITIES} />
          </Reveal>
        </div>

        {paid.length > 0 && (
          <Reveal className="mt-14 md:mt-20">
            <div className="flex items-baseline justify-between border-b border-u-ink/20 pb-4">
              <h3 className="u-mincho text-xl tracking-[0.14em]">有料オプション</h3>
              <span className="text-xs text-u-ink/65">ご予約時に追加できます</span>
            </div>
            <ul>
              {paid.map((o) => (
                <li key={o.id} className="grid gap-1 border-b border-u-ink/10 py-5 sm:grid-cols-[14rem_1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="text-[0.9375rem] font-medium tracking-[0.08em]">{o.name}</span>
                  <span className="text-sm leading-[1.9] text-u-ink/70">{o.description}</span>
                  <span className="u-num text-xl font-light sm:text-right">
                    {o.pricing_type === "flat" ? formatPrice(o.flat_price || 0) : `${formatPrice(o.price_per_person)} / 人`}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  );
};
