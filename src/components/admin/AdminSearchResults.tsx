
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useState } from "react";
import { Reservation } from "@/types/reservation";
import { formatReservationTime } from "@/utils/reservationTime";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AdminSearchResultsProps {
  reservations: Reservation[];
  isLoading?: boolean;
  /** 上限件数に達しており、さらに古い予約が隠れている可能性がある */
  isTruncated?: boolean;
  onStatusChange: (id: string, status: string, isConfirmed?: boolean) => void;
  onCustomerDetailClick?: (userKey: string) => void;
}

export const AdminSearchResults = ({
  reservations,
  isLoading = false,
  isTruncated = false,
  onStatusChange,
  onCustomerDetailClick
}: AdminSearchResultsProps) => {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge variant="default">確定</Badge>;
      case "pending":
        return <Badge variant="secondary">保留中</Badge>;
      case "cancelled":
        return <Badge variant="destructive">キャンセル</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleShowDetails = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowDetailsDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>検索結果</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "検索中..."
              : isTruncated
                ? `新しい順に${reservations.length}件を表示しています(条件を絞り込んでください)`
                : `${reservations.length}件(過去の予約を含む)`}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>名前</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>人数</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>料金</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    {format(new Date(reservation.date), "yyyy年MM月dd日", { locale: ja })}
                  </TableCell>
                  <TableCell>
                    {reservation.time_slot === "morning" ? "午前" :
                     reservation.time_slot === "afternoon" ? "午後" :
                     reservation.time_slot === "evening" ? "夕方" : "夜"}
                    {" "}
                    {formatReservationTime(reservation)}
                  </TableCell>
                  <TableCell>{reservation.guest_name}</TableCell>
                  <TableCell>{reservation.phone}</TableCell>
                  <TableCell>{reservation.guest_count}名</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Select
                        value={reservation.status}
                        onValueChange={(value) => onStatusChange(reservation.id, value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="confirmed">確定</SelectItem>
                          <SelectItem value="pending">保留中</SelectItem>
                          {reservation.status === "pending_payment" && (
                            <SelectItem value="pending_payment">決済待ち</SelectItem>
                          )}
                          <SelectItem value="cancelled">キャンセル</SelectItem>
                        </SelectContent>
                      </Select>
                      {reservation.payment_status === "paid" && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 whitespace-nowrap">支払済</Badge>
                      )}
                      {reservation.payment_status === "refunded" && (
                        <Badge variant="outline" className="whitespace-nowrap">返金済</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>¥{reservation.total_price.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowDetails(reservation)}
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

      <AdminReservationDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        reservation={selectedReservation}
        onCustomerDetailClick={onCustomerDetailClick}
      />
    </>
  );
};
