import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HerbComposition } from "./HerbComposition";
import {
  HERB_NOTE_DESCRIPTIONS,
  HERB_NOTE_LABELS,
  HERB_NOTE_SHORT,
  HERB_NOTES,
  HERB_SAFETY_NOTE,
  ORIGINAL_MAX_HERBS,
  findBlend,
  isTierComplete,
  recommendedTiers,
  tierPreview,
  type CatalogBlend,
  type HerbCatalog,
  type HerbChoice,
  type HerbInput,
  type HerbTierNumber,
} from "@/utils/herbs";

interface HerbPickerProps {
  catalog: HerbCatalog | undefined;
  isLoading?: boolean;
  isError?: boolean;
  value: HerbInput;
  onChange: (v: HerbInput) => void;
  /** 選択内容バーの固定位置。ページではヘッダーの下、ダイアログ内では上端 */
  stickyOffsetClass?: string;
}

const PAGE_STICKY_OFFSET = "top-16 md:top-[4.5rem]";

type SelectStep = HerbTierNumber | "confirm";

const CHOICES: { value: HerbChoice; latin: string; title: string; desc: string }[] = [
  { value: "select", latin: "Select", title: "事前に選ぶ", desc: "7つのブレンドから\n1段目と2段目をひとつずつ" },
  { value: "recommended", latin: "Recommended", title: "おすすめ", desc: "" },
  { value: "consult", latin: "With staff", title: "当日スタッフと一緒に選ぶ", desc: "受付で香りを確かめながら" },
];

/**
 * ハーブ蒸しの選び方（3択）と、事前に選ぶ場合のブレンド選択（1段目 → 2段目 → 確認）。
 * 予約フォームとマイページの変更画面で共用する
 */
export const HerbPicker = ({
  catalog,
  isLoading,
  isError,
  value,
  onChange,
  stickyOffsetClass = PAGE_STICKY_OFFSET,
}: HerbPickerProps) => {
  const rec = recommendedTiers(catalog);
  const recAvailable = !!rec?.available;

  if (isLoading) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3" aria-label="ハーブの情報を読み込み中">
        {CHOICES.map((c) => (
          <div key={c.value} className="h-36 animate-pulse rounded-2xl bg-u-ink/[0.05]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="ハーブ蒸しの選び方" className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {CHOICES.map(({ value: v, latin, title, desc }) => {
          const selected = value.choice === v;
          const disabled = v === "recommended" && !recAvailable;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              data-selected={selected}
              onClick={() => !disabled && onChange({ ...value, choice: v })}
              className="u-choice flex flex-col p-5"
            >
              <span className={cn("u-latin text-lg italic leading-none", selected ? "text-u-paper/70" : "text-u-ink/60")}>
                {latin}
              </span>
              <span className="mt-3 text-[0.9375rem] font-medium tracking-[0.08em]">{title}</span>
              {v === "recommended" ? (
                <span className={cn("mt-1.5 text-xs leading-relaxed", selected ? "text-u-paper/70" : "text-u-ink/65")}>
                  {rec && recAvailable ? (
                    <>
                      <span className="u-num">{rec.tier1.code}</span> {rec.tier1.title}
                      <br />
                      ＋ <span className="u-num">{rec.tier2.code}</span> {rec.tier2.title}
                    </>
                  ) : (
                    "ただいまお休み中です"
                  )}
                </span>
              ) : (
                <span className={cn("mt-1.5 whitespace-pre-line text-xs leading-relaxed", selected ? "text-u-paper/70" : "text-u-ink/65")}>
                  {desc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isError && (
        <p className="text-xs text-u-wood">ブレンドの情報を読み込めませんでした{"\u3000"}ページを再読み込みしてください</p>
      )}

      {value.choice === "select" && catalog && (
        <BlendSelector catalog={catalog} value={value} onChange={onChange} stickyOffsetClass={stickyOffsetClass} />
      )}

      <p className="text-xs leading-relaxed text-u-ink/65">{HERB_SAFETY_NOTE}</p>
    </div>
  );
};

interface BlendSelectorProps {
  catalog: HerbCatalog;
  value: HerbInput;
  onChange: (v: HerbInput) => void;
  stickyOffsetClass: string;
}

const BlendSelector = ({ catalog, value, onChange, stickyOffsetClass }: BlendSelectorProps) => {
  const bothComplete = isTierComplete(value.tiers[1], catalog) && isTierComplete(value.tiers[2], catalog);
  const [step, setStep] = useState<SelectStep>(() =>
    bothComplete ? "confirm" : isTierComplete(value.tiers[1], catalog) ? 2 : 1
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(true);

  // 段を進めたら、パネルの頭へ視線を戻す（モバイルでは選んだカードが画面の下にあるため）
  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    if (window.innerWidth < 1024) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const setTier = (tier: HerbTierNumber, blendId: string, herbIds: string[] = []) =>
    onChange({ ...value, tiers: { ...value.tiers, [tier]: { blend_id: blendId, herb_ids: herbIds } } });

  const next = (tier: HerbTierNumber) => setStep(tier === 1 ? 2 : "confirm");

  const handleBlend = (tier: HerbTierNumber, blend: CatalogBlend) => {
    if (!blend.available) return;
    const current = value.tiers[tier];
    // 同じ ORIGINAL を選び直したときは選んだハーブを残す
    setTier(tier, blend.id, blend.is_original && current.blend_id === blend.id ? current.herb_ids : []);
    if (!blend.is_original) next(tier);
  };

  const currentTier = step === "confirm" ? null : step;
  const currentBlend = currentTier ? findBlend(catalog, value.tiers[currentTier].blend_id) : undefined;

  return (
    <div ref={panelRef} className="scroll-mt-24 space-y-4">
      {/* 選んだ内容は常に上部に表示する */}
      <div
        className={cn(
          "sticky z-20 -mx-1 rounded-2xl border border-u-ink/15 bg-u-mist/95 px-4 py-3 backdrop-blur",
          stickyOffsetClass
        )}
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {([1, 2] as const).map((t, i) => {
              const preview = tierPreview(value.tiers[t], catalog);
              return (
                <span key={t} className="whitespace-nowrap">
                  {i > 0 && <span className="mr-2 text-u-ink/40">＋</span>}
                  <span className="text-xs tracking-[0.12em] text-u-ink/65">{t}段目</span>{" "}
                  <span className={cn("u-num text-base", !preview && "text-u-ink/30")}>{preview?.code ?? "—"}</span>
                </span>
              );
            })}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="tablist" aria-label="ブレンドの選択">
          {([1, 2, "confirm"] as const).map((s) => {
            const active = step === s;
            const enabled = s === 1 || (s === 2 && isTierComplete(value.tiers[1], catalog)) || (s === "confirm" && bothComplete);
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!enabled}
                onClick={() => setStep(s)}
                className={cn(
                  "rounded-full border px-2 py-1.5 text-xs tracking-[0.1em] transition-colors",
                  active ? "border-u-ink bg-u-ink text-u-paper" : "border-u-ink/20 text-u-ink/80",
                  !enabled && "opacity-40"
                )}
              >
                {s === "confirm" ? "確認" : `${s}段目を選ぶ`}
              </button>
            );
          })}
        </div>
      </div>

      {currentTier ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            {catalog.blends.map((blend) => (
              <BlendCard
                key={blend.id}
                blend={blend}
                selected={value.tiers[currentTier].blend_id === blend.id}
                onSelect={() => handleBlend(currentTier, blend)}
              />
            ))}
          </div>

          {currentBlend?.is_original && (
            <OriginalHerbPicker
              catalog={catalog}
              herbIds={value.tiers[currentTier].herb_ids}
              onChange={(ids) => setTier(currentTier, currentBlend.id, ids)}
              onDone={() => next(currentTier)}
            />
          )}
        </>
      ) : (
        <ConfirmView catalog={catalog} value={value} onEdit={setStep} />
      )}

      <NoteGuide />
    </div>
  );
};

const BlendCard = ({ blend, selected, onSelect }: { blend: CatalogBlend; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    aria-pressed={selected}
    aria-disabled={!blend.available}
    data-selected={selected}
    onClick={onSelect}
    className="u-choice flex flex-col p-4 sm:p-5"
  >
    <span className="flex w-full items-baseline justify-between gap-3">
      <span className="flex items-baseline gap-3">
        <span className={cn("u-num text-2xl font-light leading-none", selected ? "text-u-paper/70" : "text-u-ink/50")}>
          {blend.code}
        </span>
        <span className="text-[0.9375rem] font-medium tracking-[0.06em]">{blend.title}</span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2} />}
    </span>
    {blend.is_original ? (
      <span className={cn("mt-3 text-xs", selected ? "text-u-paper/70" : "text-u-ink/65")}>
        10種から{ORIGINAL_MAX_HERBS}種まで自由に選ぶ
      </span>
    ) : (
      <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {blend.herbs.map((h) => (
          <span key={h.id} className="whitespace-nowrap">
            <span className={cn("mr-1 u-num", selected ? "text-u-paper/55" : "text-u-ink/45")}>{HERB_NOTE_SHORT[h.note]}</span>
            {h.name}
          </span>
        ))}
      </span>
    )}
    {blend.description && (
      <span className={cn("mt-2.5 whitespace-pre-line text-xs leading-relaxed", selected ? "text-u-paper/70" : "text-u-ink/65")}>
        {blend.description}
      </span>
    )}
    {!blend.available ? (
      <span className="mt-2.5 text-xs">ただいまお休み中です</span>
    ) : (
      blend.caution && (
        <span className={cn("mt-2.5 text-xs", selected ? "text-u-amber" : "text-u-wood")}>※{blend.caution}</span>
      )
    )}
  </button>
);

interface OriginalHerbPickerProps {
  catalog: HerbCatalog;
  herbIds: string[];
  onChange: (ids: string[]) => void;
  onDone: () => void;
}

/** 07 ORIGINAL: ノート別に並べたハーブから 1〜3 種。4種目は選べない */
const OriginalHerbPicker = ({ catalog, herbIds, onChange, onDone }: OriginalHerbPickerProps) => {
  const full = herbIds.length >= ORIGINAL_MAX_HERBS;
  const toggle = (id: string) => {
    if (herbIds.includes(id)) onChange(herbIds.filter((x) => x !== id));
    else if (!full) onChange([...herbIds, id]);
  };

  return (
    <div className="rounded-2xl border border-u-ink/15 bg-white/40 p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <span className="u-latin text-lg italic">Original</span>
        <span className="text-xs text-u-ink/65">
          <span className="u-num text-sm text-u-ink">{herbIds.length}</span> / {ORIGINAL_MAX_HERBS}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {HERB_NOTES.map((note) => {
          const herbs = catalog.herbs.filter((h) => h.note === note);
          if (herbs.length === 0) return null;
          return (
            <div key={note}>
              <p className="text-[0.6875rem] tracking-[0.2em] text-u-ink/65">{HERB_NOTE_LABELS[note]}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {herbs.map((h) => {
                  const on = herbIds.includes(h.id);
                  const disabled = !on && full;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => toggle(h.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        on ? "border-u-ink bg-u-ink text-u-paper" : "border-u-ink/20 bg-white/50",
                        disabled && "cursor-not-allowed opacity-35"
                      )}
                    >
                      {h.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onDone}
        disabled={herbIds.length === 0}
        className="u-btn u-btn-primary mt-4 w-full !min-h-[2.75rem]"
      >
        このハーブで決める
      </button>
    </div>
  );
};

const ConfirmView = ({
  catalog,
  value,
  onEdit,
}: {
  catalog: HerbCatalog;
  value: HerbInput;
  onEdit: (step: SelectStep) => void;
}) => (
  <dl className="divide-y divide-u-ink/10 rounded-2xl border border-u-ink/15 bg-white/40">
    {([1, 2] as const).map((t) => {
      const preview = tierPreview(value.tiers[t], catalog);
      return (
        <div key={t} className="flex items-start gap-4 p-4 sm:p-5">
          <dt className="w-12 shrink-0 pt-0.5 text-xs tracking-[0.12em] text-u-ink/65">{t}段目</dt>
          <dd className="min-w-0 flex-1">
            {preview && (
              <>
                <p className="text-[0.9375rem]">
                  <span className="u-num mr-2 text-u-ink/50">{preview.code}</span>
                  {preview.title}
                </p>
                <p className="mt-1 text-xs text-u-ink/65">
                  <HerbComposition herbs={preview.herbs} />
                </p>
              </>
            )}
          </dd>
          <button type="button" onClick={() => onEdit(t)} className="u-link shrink-0 text-xs">
            変える
          </button>
        </div>
      );
    })}
  </dl>
);

/** ノートの説明（折りたたみ） */
const NoteGuide = () => (
  <details className="group rounded-2xl border border-u-ink/10 px-4 py-3 text-sm">
    <summary className="flex cursor-pointer list-none items-center justify-between text-xs tracking-[0.12em] text-u-ink/80">
      <span>
        <span className="u-latin mr-2 text-base italic">Note</span>TOP・MIDDLE・BASE について
      </span>
      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.5} />
    </summary>
    <dl className="mt-3 space-y-1.5 text-xs">
      {HERB_NOTES.map((note) => (
        <div key={note} className="grid grid-cols-[4.5rem_1fr] gap-2">
          <dt className="tracking-[0.12em] text-u-ink/65">{HERB_NOTE_LABELS[note]}</dt>
          <dd>{HERB_NOTE_DESCRIPTIONS[note]}</dd>
        </div>
      ))}
    </dl>
  </details>
);
