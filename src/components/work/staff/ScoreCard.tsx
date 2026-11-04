import { Flame, Sparkles } from "lucide-react";
import type { StaffWorkScore } from "../staffWorkTypes";
import { formatYen } from "../workUtils";

/** 今月のポイントと目安・ボーナス見込み。目安を超えた分がボーナスになる */
export const ScoreCard = ({ score }: { score: StaffWorkScore }) => {
  const points = score.month_points ?? 0;
  const target = Number(score.target_points ?? 0);
  const bonus = score.bonus_yen ?? 0;
  const overTarget = target > 0 && points > target;
  // 目安までをバーの 2/3 に置き、超過分を残り 1/3 に積む
  const baseRatio = target > 0 ? Math.min(points / target, 1) * (2 / 3) : 0;
  const overRatio =
    target > 0 && overTarget ? Math.min((points - target) / (target / 2), 1) * (1 / 3) : 0;
  // ボーナスは目安を 1pt 超えたところから
  const toTarget = Math.max(1, Math.floor(target - points) + 1);

  return (
    <section className="rounded-xl bg-zinc-900 p-4 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/60">今月のポイント</p>
          <p className="text-4xl font-bold tabular-nums">
            {points}
            <span className="ml-1 text-base font-normal text-white/60">pt</span>
          </p>
        </div>
        <div className="space-y-1 text-right text-sm">
          <p>
            今日 <span className="font-semibold tabular-nums">+{score.today_points}pt</span>
          </p>
          {score.streak_days > 0 && (
            <p className="flex items-center justify-end gap-1 text-amber-300">
              <Flame className="h-4 w-4" />
              {score.streak_days}日連続
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-3 overflow-hidden rounded-full bg-white/15">
          <div className="absolute inset-y-0 left-0 bg-sky-400" style={{ width: `${baseRatio * 100}%` }} />
          <div
            className="absolute inset-y-0 bg-amber-400"
            style={{ left: `${(2 / 3) * 100}%`, width: `${overRatio * 100}%` }}
          />
          <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(2 / 3) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-white/60">
          <span>勤務 {Number(score.work_hours ?? 0)}時間</span>
          <span>目安 {target}pt</span>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1 text-sm">
        {overTarget ? (
          <>
            <Sparkles className="h-4 w-4 text-amber-300" />
            ボーナス見込み <span className="font-bold text-amber-300">{formatYen(bonus)}</span>
          </>
        ) : target > 0 ? (
          <>あと {toTarget}pt でボーナス圏（1pt = {formatYen(score.yen_per_point)}）</>
        ) : (
          <>シフトの勤務時間に応じて目安が決まります</>
        )}
      </p>
    </section>
  );
};
