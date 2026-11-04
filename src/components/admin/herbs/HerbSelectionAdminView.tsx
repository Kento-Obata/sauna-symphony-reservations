import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HERB_CHOICE_LABELS,
  formatComposition,
  formatTierShort,
  isHerbChoice,
  parseHerbSelection,
  selectionNeedsPrep,
} from "@/utils/herbs";

const PREP_BADGE = "bg-amber-100 text-amber-900 hover:bg-amber-100";
const CONSULT_BADGE = "bg-sky-100 text-sky-900 hover:bg-sky-100";

/** 予約一覧用の1行表示。仕込みが要る(06・07)・受付で相談が要る予約を目立たせる */
export const HerbSelectionBadge = ({ choice, selection }: { choice: unknown; selection: unknown }) => {
  if (!isHerbChoice(choice)) return null;
  const parsed = parseHerbSelection(selection);
  if (!parsed) {
    return <Badge className={CONSULT_BADGE}>🌿 受付で相談</Badge>;
  }
  const label = choice === "recommended" ? "おすすめ" : choice === "consult" ? "当日決定" : "事前";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="font-normal">
        🌿 {label} {parsed.tiers.map((t) => t.code).join("＋")}
      </Badge>
      {selectionNeedsPrep(parsed) && <Badge className={PREP_BADGE}>仕込み</Badge>}
    </span>
  );
};

interface HerbSelectionAdminViewProps {
  choice: unknown;
  selection: unknown;
  updatedAt?: string | null;
  updatedBy?: string | null;
  className?: string;
}

const formatUpdatedAt = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

/** 予約詳細・仕込みリスト用: 選び方と段ごとの構成 */
export const HerbSelectionAdminView = ({ choice, selection, updatedAt, updatedBy, className }: HerbSelectionAdminViewProps) => {
  if (!isHerbChoice(choice)) {
    return <p className={cn("text-sm text-muted-foreground", className)}>未設定（ハーブ選択の導入前の予約）</p>;
  }
  const parsed = parseHerbSelection(selection);

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{HERB_CHOICE_LABELS[choice]}</Badge>
        {!parsed && <Badge className={CONSULT_BADGE}>受付で相談</Badge>}
        {parsed && selectionNeedsPrep(parsed) && <Badge className={PREP_BADGE}>仕込み</Badge>}
        {updatedAt && (
          <span className="text-xs text-muted-foreground">
            {formatUpdatedAt(updatedAt)} {updatedBy === "staff" ? "スタッフ" : "お客様"}が設定
          </span>
        )}
      </div>
      {parsed?.tiers.map((t) => (
        <div
          key={t.tier}
          className={cn("rounded-md border px-3 py-2", t.needs_prep && "border-amber-300 bg-amber-50")}
        >
          <p>
            <span className="mr-2 text-xs text-muted-foreground">{t.tier}段目</span>
            <span className="font-medium">{formatTierShort(t)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatComposition(t.herbs)}</p>
          {t.caution && <p className="text-xs text-amber-800">※{t.caution}</p>}
        </div>
      ))}
    </div>
  );
};
