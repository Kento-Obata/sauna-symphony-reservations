
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useState } from "react";
import { Reservation } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AdminSearchResultsProps {
  reservations: Reservation[];
  onStatusChange: (id: string, status: string, isConfirmed?: boolean) => void;
  onCustomerDetailClick?: (userKey: string) => void;
}

export const AdminSearchResults = ({ 
  reservations, 
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
                     reservation.time_slot === "afternoon" ? "午後" : "夜"}
                  </TableCell>
                  <TableCell>{reservation.guest_name}</TableCell>
                  <TableCell>{reservation.phone}</TableCell>
                  <TableCell>{reservation.guest_count}名</TableCell>
                  <TableCell>
                    <Select
                      value={reservation.status}
                      onValueChange={(value) => onStatusChange(reservation.id, value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">確定</SelectItem>
                        <SelectItem value="pending">保留中</SelectItem>
                        <SelectItem value="cancelled">キャンセル</SelectItem>
                      </SelectContent>
                    </Select>
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
