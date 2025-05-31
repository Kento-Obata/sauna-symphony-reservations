
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface PendingRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  start_hour: number;
  end_hour: number;
  note?: string;
  created_at: string;
}

export const AdminShiftManagement = () => {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      // 実際のデータ取得は後で実装
      // 今は仮のデータを表示
      const mockData: PendingRequest[] = [
        {
          id: "1",
          staff_id: "staff1",
          staff_name: "田中太郎",
          date: "2024-01-15",
          start_hour: 9,
          end_hour: 17,
          note: "午前中は研修があります",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          staff_id: "staff2", 
          staff_name: "佐藤花子",
          date: "2024-01-16",
          start_hour: 10,
          end_hour: 18,
          created_at: new Date().toISOString(),
        },
      ];
      
      setPendingRequests(mockData);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      // 実際の承認処理は後で実装
      console.log("Approving request:", requestId);
      
      toast.success("シフト希望を承認しました");
      fetchPendingRequests(); // データを再取得
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("承認に失敗しました");
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) {
      toast.error("却下理由を入力してください");
      return;
    }

    try {
      // 実際の却下処理は後で実装
      console.log("Rejecting request:", requestId, "Reason:", rejectReason);
      
      toast.success("シフト希望を却下しました");
      setSelectedRequest(null);
      setRejectReason("");
      fetchPendingRequests(); // データを再取得
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("却下に失敗しました");
    }
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>シフト希望の管理</CardTitle>
      </CardHeader>
      <CardContent>
        {pendingRequests.length === 0 ? (
          <p className="text-center text-gray-500">承認待ちのシフト希望はありません</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ</TableHead>
                <TableHead>日付</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>備考</TableHead>
                <TableHead>申請日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.staff_name}</TableCell>
                  <TableCell>
                    {format(new Date(request.date), "MM月dd日(E)", { locale: ja })}
                  </TableCell>
                  <TableCell>
                    {request.start_hour.toString().padStart(2, '0')}:00 - {request.end_hour.toString().padStart(2, '0')}:00
                  </TableCell>
                  <TableCell>{request.note || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), "MM月dd日", { locale: ja })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                      >
                        承認
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setSelectedRequest(request)}
                          >
                            却下
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>シフト希望の却下</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p>
                              {selectedRequest?.staff_name}さんの
                              {selectedRequest && format(new Date(selectedRequest.date), "MM月dd日", { locale: ja })}の
                              シフト希望を却下しますか？
                            </p>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                却下理由
                              </label>
                              <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="却下理由を入力してください"
                                rows={3}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(null);
                                  setRejectReason("");
                                }}
                              >
                                キャンセル
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => selectedRequest && handleReject(selectedRequest.id)}
                              >
                                却下
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
