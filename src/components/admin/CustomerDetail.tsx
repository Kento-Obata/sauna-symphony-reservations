
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useCustomerReservations, useReservationDetails } from "@/hooks/useCustomers";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState } from "react";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";

interface CustomerDetailProps {
  userKey: string;
  onBack: () => void;
}

export const CustomerDetail = ({ userKey, onBack }: CustomerDetailProps) => {
  const { data: reservations, isLoading } = useCustomerReservations(userKey);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  
  const { data: selectedReservationDetails } = useReservationDetails(selectedReservationId || "");

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (!reservations || reservations.length === 0) {
    return <div>予約データが見つかりません</div>;
  }

  const customer = reservations[0];
  const stats = {
    total: reservations.length,
    completed: reservations.filter(r => r.status !== 'cancelled').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default">確定</Badge>;
      case 'pending':
        return <Badge variant="secondary">保留中</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">キャンセル</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <h2 className="text-2xl font-bold">顧客詳細</h2>
      </div>

      {/* 顧客情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">名前</div>
              <div className="font-medium">{customer.guest_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">電話番号</div>
              <div className="font-medium">{customer.phone}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">メールアドレス</div>
              <div className="font-medium">{customer.email || "未登録"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">顧客ID</div>
              <div className="font-medium text-xs">{userKey}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 統計情報 */}
      <Card>
        <CardHeader>
          <CardTitle>予約統計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-500">総予約数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">完了予約</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              <div className="text-sm text-gray-500">キャンセル</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 予約履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>予約履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>料金</TableHead>
                <TableHead>メモ</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.reservation_id}>
                  <TableCell>
                    {format(new Date(reservation.date), "yyyy年MM月dd日", { locale: ja })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(reservation.status)}
                  </TableCell>
                  <TableCell>
                    ¥{reservation.total_price.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {reservation.admin_memo ? (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">メモあり</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReservationId(reservation.reservation_id);
                        setShowReservationDialog(true);
                      }}
                    >
                      詳細
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 予約詳細ダイアログ */}
      {selectedReservationDetails && (
        <AdminReservationDetailsDialog
          open={showReservationDialog}
          onOpenChange={setShowReservationDialog}
          reservation={selectedReservationDetails}
        />
      )}
    </div>
  );
};
