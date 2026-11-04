import { HERB_NOTE_SHORT, type HerbRef } from "@/utils/herbs";

/** "T レモングラス / M ローズマリー / B セージ"。ハーブの途中で改行しないよう1つずつ折り返さない */
export const HerbComposition = ({ herbs, className }: { herbs: HerbRef[]; className?: string }) => (
  <span className={className}>
    {herbs.map((h, i) => (
      <span key={h.id} className="whitespace-nowrap">
        {i > 0 && <span className="mx-1 opacity-50">/</span>}
        {HERB_NOTE_SHORT[h.note]} {h.name}
      </span>
    ))}
  </span>
);
