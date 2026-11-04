import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatYen, todayJst } from "../workUtils";

export const WorkBonus = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => todayJst().slice(0, 7));
  const [year, monthNum] = month.split("-").map(Number);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["work-bonus", month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("work_bonus_summary", { p_year: year, p_month: monthNum });
      if (error) throw error;
      return [...data].sort((a, b) => b.points - a.points);
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["work-point-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_point_settings").select("*").single();
      if (error) throw error;
      return data;
    },
  });

  const [pointsPerHour, setPointsPerHour] = useState("");
  const [yenPerPoint, setYenPerPoint] = useState("");
  const [cap, setCap] = useState("");

  useEffect(() => {
    if (!settings) return;
    setPointsPerHour(String(settings.target_points_per_hour));
    setYenPerPoint(String(settings.yen_per_point));
    setCap(String(settings.monthly_bonus_cap));
  }, [settings]);

  const saveSettings = async () => {
    const { error } = await supabase
      .from("work_point_settings")
      .update({
        target_points_per_hour: Number(pointsPerHour),
        yen_per_point: parseInt(yenPerPoint),
        monthly_bonus_cap: parseInt(cap),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) {
      console.error("Error saving point settings:", error);
      toast.error("保存に失敗しました");
      return;
    }
    toast.success("ボーナス設定を保存しました");
    queryClient.invalidateQueries({ queryKey: ["work-point-settings"] });
    queryClient.invalidateQueries({ queryKey: ["work-bonus"] });
  };

  const totalBonus = summary?.reduce((sum, row) => sum + row.bonus_yen, 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            月ごとのポイントとボーナス
            <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
          </CardTitle>
          <CardDescription>
            目安 = その月の勤務時間（開始済みのシフト、休憩を除く）× 目安pt/時間。目安を超えたポイント × 円/pt がボーナス（上限あり）。否認したログは数えません
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : !summary?.length ? (
            <p className="text-sm text-muted-foreground">この月の記録・シフトはありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>スタッフ</TableHead>
                  <TableHead className="text-right">勤務時間</TableHead>
                  <TableHead className="text-right">記録</TableHead>
                  <TableHead className="text-right">ポイント / 目安</TableHead>
                  <TableHead className="text-right">ボーナス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.staff_id}>
                    <TableCell>{row.staff_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.work_hours)}h</TableCell>
                    <TableCell className="text-right tabular-nums">{row.log_count}件</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={row.points > Number(row.target_points) ? "font-semibold text-emerald-700" : ""}>
                        {row.points}
                      </span>{" "}
                      / {Number(row.target_points)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.bonus_yen > 0 ? formatYen(row.bonus_yen) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right text-muted-foreground">
                    合計
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatYen(totalBonus)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ボーナス設定</CardTitle>
          <CardDescription>変更すると過去の月の計算にも反映されます。支給額は月末に確定させてください</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="pts-per-hour">目安（pt / 勤務1時間）</Label>
            <Input id="pts-per-hour" type="number" step="0.1" min={0} value={pointsPerHour} onChange={(e) => setPointsPerHour(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="yen-per-pt">1ptあたり（円）</Label>
            <Input id="yen-per-pt" type="number" min={0} value={yenPerPoint} onChange={(e) => setYenPerPoint(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bonus-cap">月の上限（円）</Label>
            <Input id="bonus-cap" type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} className="w-32" />
          </div>
          <Button onClick={saveSettings}>保存</Button>
        </CardContent>
      </Card>
    </div>
  );
};
