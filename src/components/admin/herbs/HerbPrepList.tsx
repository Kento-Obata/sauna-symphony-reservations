import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getJstTodayYmd } from "@/utils/jstDate";
import { formatReservationTime } from "@/utils/reservationTime";
import { isHerbChoice, parseHerbSelection, selectionNeedsPrep } from "@/utils/herbs";
import { AdminHerbEditor } from "./AdminHerbEditor";

const STATUS_LABELS: Record<string, string> = {
  pending: "仮予約（メール確認待ち）",
  pending_payment: "決済手続き中",
};

const shiftYmd = (ymd: string, days: number) => format(addDays(parseISO(ymd), days), "yyyy-MM-dd");

/**
 * 日別のハーブ仕込みリスト。確定済みの予約を枠順に並べ、1段目・2段目の内容を出す。
 * 06・07（仕込みが要る）と、受付で相談が要る「当日」の予約を目立たせる。
 * 受付で決まった内容はここから直接入力できる
 */
export const HerbPrepList = () => {
  const today = getJstTodayYmd();
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ["herb-prep", date],
    queryFn: async () => {
      const [reservationsRes, affectedRes] = await Promise.all([
        supabase
          .from("reservations")
          .select(
            "id, reservation_code, date, time_slot, start_time, end_time, guest_name, guest_count, status, herb_choice, herb_selection, herb_updated_at, herb_updated_by"
          )
          .eq("date", date)
          .in("status", ["confirmed", "pending", "pending_payment"])
          .order("start_time"),
        supabase.from("herb_affected_reservations").select("id").eq("date", date),
      ]);
      if (reservationsRes.error) throw reservationsRes.error;
      if (affectedRes.error) throw affectedRes.error;
      return {
        reservations: reservationsRes.data,
        affected: new Set(affectedRes.data.map((r) => r.id)),
      };
    },
    refetchInterval: 60_000,
  });

  const confirmed = useMemo(() => data?.reservations.filter((r) => r.status === "confirmed") ?? [], [data]);
  const unconfirmed = useMemo(() => data?.reservations.filter((r) => r.status !== "confirmed") ?? [], [data]);

  // ブレンドごとの段数（仕込む量の目安）
  const blendCounts = useMemo(() => {
    const counts = new Map<string, { title: string; count: number; needsPrep: boolean }>();
    for (const r of confirmed) {
      for (const t of parseHerbSelection(r.herb_selection)?.tiers ?? []) {
        const current = counts.get(t.code) ?? { title: t.title, count: 0, needsPrep: t.needs_prep };
        counts.set(t.code, { ...current, count: current.count + 1 });
      }
    }
    return Array.from(counts, ([code, v]) => ({ code, ...v })).sort((a, b) => a.code.localeCompare(b.code));
  }, [confirmed]);
  const consultCount = confirmed.filter((r) => r.herb_choice === "consult" && !parseHerbSelection(r.herb_selection)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
        <Button variant={date === today ? "default" : "outline"} size="sm" onClick={() => setDate(today)}>
          今日
        </Button>
        <Button
          variant={date === shiftYmd(today, 1) ? "default" : "outline"}
          size="sm"
          onClick={() => setDate(shiftYmd(today, 1))}
        >
          明日
        </Button>
        <span className="text-sm text-muted-foreground">{format(parseISO(date), "M月d日（E）", { locale: ja })}</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6 text-sm">
          <span className="text-muted-foreground">仕込みの目安</span>
          {blendCounts.length === 0 && consultCount === 0 && <span>なし</span>}
          {blendCounts.map((b) => (
            <Badge
              key={b.code}
              variant="outline"
              className={cn("font-normal", b.needsPrep && "border-amber-300 bg-amber-50 text-amber-900")}
            >
              {b.code} {b.title} ×{b.count}
            </Badge>
          ))}
          {consultCount > 0 && (
            <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">受付で相談 {consultCount}組</Badge>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : confirmed.length === 0 ? (
        <p className="text-sm text-muted-foreground">この日の確定済みの予約はありません</p>
      ) : (
        confirmed.map((r) => {
          const needsPrep = selectionNeedsPrep(r.herb_selection);
          const consult = r.herb_choice === "consult" && !parseHerbSelection(r.herb_selection);
          const outOfStock = data?.affected.has(r.id);
          return (
            <Card
              key={r.id}
              className={cn(needsPrep && "border-amber-300", consult && "border-sky-300", outOfStock && "border-red-400")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>
                    {formatReservationTime(r)}{"\u3000"}{r.guest_name}様（{r.guest_count}名）
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {outOfStock && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        在庫切れを含む・要連絡
                      </Badge>
                    )}
                    {!isHerbChoice(r.herb_choice) && <Badge variant="outline">導入前の予約</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminHerbEditor
                  reservationId={r.id}
                  choice={r.herb_choice}
                  selection={r.herb_selection}
                  updatedAt={r.herb_updated_at}
                  updatedBy={r.herb_updated_by}
                />
              </CardContent>
            </Card>
          );
        })
      )}

      {unconfirmed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">未確定の予約（仕込みの対象外）</h3>
          {unconfirmed.map((r) => (
            <div key={r.id} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {formatReservationTime(r)}{"\u3000"}{r.guest_name}様（{r.guest_count}名）・{STATUS_LABELS[r.status] ?? r.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
