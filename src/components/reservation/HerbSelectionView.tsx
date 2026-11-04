import { HerbComposition } from "@/components/site/booking/HerbComposition";
import { describeSavedHerbChoice, parseHerbSelection } from "@/utils/herbs";

interface HerbSelectionViewProps {
  choice: unknown;
  selection: unknown;
}

/** お客様向け: 保存済みのハーブ蒸しの選び方と段ごとの内容。機能導入前の予約は何も出さない */
export const HerbSelectionView = ({ choice, selection }: HerbSelectionViewProps) => {
  const heading = describeSavedHerbChoice(choice, selection);
  if (!heading) return null;
  const tiers = parseHerbSelection(selection)?.tiers ?? [];

  return (
    <div>
      <p>{heading}</p>
      {tiers.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {tiers.map((t) => (
            <li key={t.tier} className="text-xs leading-relaxed">
              <span className="mr-2 tracking-[0.12em] text-u-ink/65">{t.tier}段目</span>
              <span className="u-num mr-1.5">{t.code}</span>
              {t.title}
              <HerbComposition herbs={t.herbs} className="block text-u-ink/65" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
