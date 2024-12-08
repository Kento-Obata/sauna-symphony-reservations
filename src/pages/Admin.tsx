import { format } from "date-fns";
import { ja } from "date-fns/locale";  // Add this import
import { TIME_SLOTS } from "@/components/TimeSlotSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut } from "lucide-react";
import { AdminReservationDialog } from "@/components/admin/AdminReservationDialog";
import { useState } from "react";
import { useReservations } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminUpcomingReservations } from "@/components/admin/AdminUpcomingReservations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle } from "lucide-react";

const Admin = () => {
  const [showNewReservationDialog, setShowNewReservationDialog] = useState(false);
  const { data: reservations } = useReservations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const navigate = useNavigate();
  const [nameQuery, setNameQuery] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [dateQuery, setDateQuery] = useState<Date | undefined>(undefined);

  const handleNewReservation = () => {
    setSelectedDate(new Date());
    setShowNewReservationDialog(true);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("ログアウトしました");
      navigate("/admin/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("ログアウトに失敗しました");
    }
  };

  const handleClearFilters = () => {
    setNameQuery("");
    setPhoneQuery("");
    setDateQuery(undefined);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success("予約状態を更新しました");
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("予約状態の更新に失敗しました");
    }
  };

  const filteredReservations = reservations?.filter((reservation) => {
    const matchesName = reservation.guest_name
      .toLowerCase()
      .includes(nameQuery.toLowerCase());
    const matchesPhone = reservation.phone
      .toLowerCase()
      .includes(phoneQuery.toLowerCase());
    const matchesDate = dateQuery
      ? reservation.date === format(dateQuery, "yyyy-MM-dd")
      : true;
    return matchesName && matchesPhone && matchesDate;
  });

  const upcomingReservations = reservations?.filter(
    (reservation) => reservation.status !== "cancelled" && 
    new Date(reservation.date) >= new Date(new Date().setHours(0, 0, 0, 0))
  ).sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return dateComparison;
    const timeSlotOrder = { morning: 0, afternoon: 1, evening: 2 };
    return timeSlotOrder[a.time_slot] - timeSlotOrder[b.time_slot];
  }).slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">予約管理</h1>
        <div className="flex gap-4">
          <Button 
            onClick={handleNewReservation}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            新規予約
          </Button>
          <Button 
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </div>

      <AdminSearchBar
        nameQuery={nameQuery}
        setNameQuery={setNameQuery}
        phoneQuery={phoneQuery}
        setPhoneQuery={setPhoneQuery}
        dateQuery={dateQuery}
        setDateQuery={setDateQuery}
        onClearFilters={handleClearFilters}
      />

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AdminCalendar 
            reservations={filteredReservations} 
            onDateSelect={setSelectedDate}
          />
          
          <Card className="mt-8">
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
                    <TableHead>ステータス</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations?.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>
                        {format(new Date(reservation.date), "M月d日(E)", {
                          locale: ja,  // Ensure 'ja' is used here
                        })}
                      </TableCell>
                      <TableCell>
                        {TIME_SLOTS[reservation.time_slot].start}-
                        {TIME_SLOTS[reservation.time_slot].end}
                      </TableCell>
                      <TableCell>{reservation.guest_name}様</TableCell>
                      <TableCell>{reservation.guest_count}名</TableCell>
                      <TableCell>{reservation.phone}</TableCell>
                      <TableCell>
                        {reservation.status === "cancelled" ? "キャンセル済" : "予約済"}
                      </TableCell>
                      <TableCell>
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
                                  onClick={() => handleStatusChange(reservation.id, "cancelled")}
                                >
                                  はい
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredReservations || filteredReservations.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        検索結果はありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <AdminUpcomingReservations 
            reservations={upcomingReservations}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      <AdminReservationDialog
        open={showNewReservationDialog}
        onOpenChange={setShowNewReservationDialog}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default Admin;
