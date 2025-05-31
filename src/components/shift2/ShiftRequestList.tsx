
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface ShiftRequest {
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  status: string;
  note?: string;
  created_at: string;
}

export const ShiftRequestList = () => {
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      // 実際のユーザーIDを取得する必要がある
      // 今は仮のデータを表示
      const mockData: ShiftRequest[] = [
        {
          id: "1",
          date: "2024-01-15",
          start_hour: 9,
          end_hour: 17,
          status: "pending",
          note: "午前中は研修があります",
          created_at: new Date().toISOString(),
        },
        {
          id: "2", 
          date: "2024-01-16",
          start_hour: 10,
          end_hour: 18,
          status: "approved",
          created_at: new Date().toISOString(),
        },
      ];
      
      setRequests(mockData);
    } catch (error) {
      console.error("Error fetching shift requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">審査中</Badge>;
      case "approved":
        return <Badge variant="default">承認済み</Badge>;
      case "rejected":
        return <Badge variant="destructive">却下</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <p className="text-center text-gray-500">申請したシフト希望はありません</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>時間</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>備考</TableHead>
              <TableHead>申請日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  {format(new Date(request.date), "yyyy年MM月dd日", { locale: ja })}
                </TableCell>
                <TableCell>
                  {request.start_hour.toString().padStart(2, '0')}:00 - {request.end_hour.toString().padStart(2, '0')}:00
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>{request.note || "-"}</TableCell>
                <TableCell>
                  {format(new Date(request.created_at), "MM月dd日", { locale: ja })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
