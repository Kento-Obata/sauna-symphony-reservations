
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState } from "react";
import { Reservation } from "@/types/reservation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle, Edit } from "lucide-react";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { formatPrice } from "@/utils/priceCalculations";

interface AdminSearchResultsProps {
  reservations: Reservation[];
  onStatusChange: (id: string, status: string) => void;
}

export const AdminSearchResults = ({
  reservations,
  onStatusChange,
}: AdminSearchResultsProps) => {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

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
                <TableHead>時間帯</TableHead>
                <TableHead>お客様名</TableHead>
                <TableHead>人数</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>料金</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    {format(new Date(reservation.date), "M月d日(E)", {
                      locale: ja,
                    })}
                  </TableCell>
                  <TableCell>
                    {TIME_SLOTS[reservation.time_slot].start}-
                    {TIME_SLOTS[reservation.time_slot].end}
                  </TableCell>
                  <TableCell>{reservation.guest_name}様</TableCell>
                  <TableCell>{reservation.guest_count}名</TableCell>
                  <TableCell>{reservation.phone}</TableCell>
                  <TableCell>{formatPrice(reservation.total_price)}</TableCell>
                  <TableCell>
                    {reservation.status === "cancelled" ? "キャンセル済" : "予約済"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setSelectedReservation(reservation)}
                      >
                        <Edit className="h-4 w-4" />
                        詳細
                      </Button>
                      {reservation.status !== "cancelled" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              キャンセル
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>いいえ</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onStatusChange(reservation.id, "cancelled")}
                              >
                                はい
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {reservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    検索結果はありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminReservationDetailsDialog
        open={!!selectedReservation}
        onOpenChange={(open) => !open && setSelectedReservation(null)}
        reservation={selectedReservation}
      />
    </>
  );
};
