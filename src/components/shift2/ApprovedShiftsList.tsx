
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface ApprovedShift {
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  note?: string;
}

export const ApprovedShiftsList = () => {
  const [shifts, setShifts] = useState<ApprovedShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApprovedShifts();
  }, []);

  const fetchApprovedShifts = async () => {
    try {
      // 実際のデータ取得は後で実装
      // 今は仮のデータを表示
      const mockData: ApprovedShift[] = [
        {
          id: "1",
          date: "2024-01-16",
          start_hour: 10,
          end_hour: 18,
          note: "通常業務",
        },
        {
          id: "2",
          date: "2024-01-20",
          start_hour: 9,
          end_hour: 15,
          note: "午後は研修のため早退",
        },
      ];
      
      setShifts(mockData);
    } catch (error) {
      console.error("Error fetching approved shifts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      {shifts.length === 0 ? (
        <p className="text-center text-gray-500">承認済みのシフトはありません</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>時間</TableHead>
              <TableHead>備考</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>
                  {format(new Date(shift.date), "yyyy年MM月dd日(E)", { locale: ja })}
                </TableCell>
                <TableCell>
                  {shift.start_hour.toString().padStart(2, '0')}:00 - {shift.end_hour.toString().padStart(2, '0')}:00
                </TableCell>
                <TableCell>{shift.note || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
