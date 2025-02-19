
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut } from "lucide-react";
import { AdminReservationDialog } from "@/components/admin/AdminReservationDialog";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminUpcomingReservations } from "@/components/admin/AdminUpcomingReservations";
import { AdminSearchResults } from "@/components/admin/AdminSearchResults";
import { ShopClosureManager } from "@/components/admin/ShopClosureManager";
import { PriceSettingsManager } from "@/components/admin/PriceSettingsManager";
import { useReservations } from "@/hooks/useReservations";

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
  });

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

      {(nameQuery || phoneQuery || dateQuery) && (
        <div className="mb-8">
          <AdminSearchResults
            reservations={filteredReservations || []}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <AdminCalendar 
            reservations={reservations} 
            onDateSelect={setSelectedDate}
          />
        </div>
        <div>
          <AdminUpcomingReservations 
            reservations={upcomingReservations}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      <div className="mb-8">
        <ShopClosureManager />
      </div>

      <div className="mb-8">
        <PriceSettingsManager />
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
