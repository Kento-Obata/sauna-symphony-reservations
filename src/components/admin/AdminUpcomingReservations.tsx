
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminReservationDetailsDialog } from "./AdminReservationDetailsDialog";
import { useState } from "react";
import { Reservation } from "@/types/reservation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AdminUpcomingReservationsProps {
  reservations?: Reservation[];
  onStatusChange: (id: string, status: string, isConfirmed?: boolean) => void;
  onCustomerDetailClick?: (userKey: string) => void;
}

export const AdminUpcomingReservations = ({ 
  reservations = [], 
  onStatusChange,
  onCustomerDetailClick 
}: AdminUpcomingReservationsProps) => {
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

  const getTimeSlotText = (timeSlot: string) => {
    switch (timeSlot) {
      case "morning":
        return "午前";
      case "afternoon":
        return "午後";
      case "evening":
        return "夜";
      default:
        return timeSlot;
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
          <CardTitle>今後の予約</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reservations.length === 0 ? (
              <p className="text-center text-gray-500">今後の予約はありません</p>
            ) : (
              reservations.slice(0, 10).map((reservation) => (
                <div key={reservation.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">
                        {format(new Date(reservation.date), "MM月dd日", { locale: ja })} 
                        ({getTimeSlotText(reservation.time_slot)})
                      </div>
                      <div className="text-sm text-gray-600">
                        {reservation.guest_name}様 ({reservation.guest_count}名)
                      </div>
                      <div className="text-sm text-gray-500">
                        {reservation.phone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        ¥{reservation.total_price.toLocaleString()}
                      </div>
                      {getStatusBadge(reservation.status)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowDetails(reservation)}
                    >
                      詳細
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
