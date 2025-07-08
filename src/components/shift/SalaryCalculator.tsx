import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const SalaryCalculator = () => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());

  const { data: salarySummary, isLoading } = useQuery({
    queryKey: ["salary-summary", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_salary_summary")
        .select("*")
        .eq("year", parseInt(selectedYear))
        .eq("month", parseInt(selectedMonth))
        .order("staff_name");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedYear && !!selectedMonth,
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const totalSalary = salarySummary?.reduce((sum, item) => sum + (item.total_salary || 0), 0) || 0;

  const copyToClipboard = async (item: any) => {
    console.log("コピー対象スタッフ:", item);
    
    // シフト詳細を取得
    const { data: shifts, error } = await supabase
      .from("shifts")
      .select("start_time, end_time, break_minutes")
      .eq("staff_id", item.staff_id)
      .eq("status", "scheduled")
      .gte("start_time", `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`)
      .lt("start_time", `${selectedYear}-${selectedMonth.padStart(2, '0') === '12' ? parseInt(selectedYear) + 1 : selectedYear}-${selectedMonth.padStart(2, '0') === '12' ? '01' : (parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-01`)
      .order("start_time");

    console.log("シフトクエリ結果:", { shifts, error });
    console.log("検索期間:", {
      from: `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`,
      to: `${selectedYear}-${selectedMonth.padStart(2, '0') === '12' ? parseInt(selectedYear) + 1 : selectedYear}-${selectedMonth.padStart(2, '0') === '12' ? '01' : (parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-01`
    });

    let shiftDetails = "";
    if (shifts && shifts.length > 0) {
      shiftDetails = "\n【シフト詳細】\n";
      shifts.forEach((shift, index) => {
        const startTime = new Date(shift.start_time);
        const endTime = new Date(shift.end_time);
        const workHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        const breakHours = (shift.break_minutes || 0) / 60;
        const actualWorkHours = Math.round((workHours - breakHours) * 10) / 10;
        
        shiftDetails += `${index + 1}. ${startTime.getMonth() + 1}/${startTime.getDate()}(${['日','月','火','水','木','金','土'][startTime.getDay()]}) ${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}-${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')} (実働${actualWorkHours}h)\n`;
      });
    } else {
      console.log("シフトデータが見つかりませんでした");
    }

    const text = `【${selectedYear}年${selectedMonth}月の給与明細】
スタッフ名: ${item.staff_name}さん
シフト数: ${item.total_shifts}回
労働時間: ${Math.round((item.total_work_hours || 0) * 10) / 10}時間
休憩時間: ${Math.round((item.total_break_hours || 0) * 10) / 10}時間
給与: ¥${Math.round(item.total_salary || 0).toLocaleString()}${shiftDetails}

お疲れ様でした！
もし修正あれば個別で連絡お願いします。`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${item.staff_name}さんの給与明細をコピーしました`);
    } catch (error) {
      toast.error("コピーに失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>給与計算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div>
              <label className="text-sm font-medium">年</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">月</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div>計算中...</div>
          ) : (
            <div className="space-y-4">
              <div className="text-lg font-semibold">
                {selectedYear}年{selectedMonth}月の給与合計: ¥{Math.round(totalSalary).toLocaleString()}
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>スタッフ名</TableHead>
                    <TableHead>シフト数</TableHead>
                    <TableHead>労働時間</TableHead>
                    <TableHead>休憩時間</TableHead>
                    <TableHead>給与</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarySummary?.map((item) => (
                    <TableRow key={`${item.staff_id}-${item.year}-${item.month}`}>
                      <TableCell>{item.staff_name}</TableCell>
                      <TableCell>{item.total_shifts}回</TableCell>
                      <TableCell>{Math.round((item.total_work_hours || 0) * 10) / 10}時間</TableCell>
                      <TableCell>{Math.round((item.total_break_hours || 0) * 10) / 10}時間</TableCell>
                      <TableCell>¥{Math.round(item.total_salary || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(item)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-4 w-4" />
                          コピー
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {salarySummary?.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  該当期間のシフトデータがありません
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};