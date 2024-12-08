import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminUpcomingReservations } from "@/components/admin/AdminUpcomingReservations";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut } from "lucide-react";
import { AdminReservationDialog } from "@/components/admin/AdminReservationDialog";
import { useState } from "react";
import { useReservations } from "@/hooks/useReservations";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { format } from "date-fns";

const Admin = () => {
  const [showNewReservationDialog, setShowNewReservationDialog] = useState(false);
  const { data: reservations } = useReservations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const navigate = useNavigate();
  const [nameQuery, setNameQuery] = useState("");
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
    setDateQuery(undefined);
  };

  const filteredReservations = reservations?.filter((reservation) => {
    const matchesName = reservation.guest_name
      .toLowerCase()
      .includes(nameQuery.toLowerCase());
    const matchesDate = dateQuery
      ? reservation.date === format(dateQuery, "yyyy-MM-dd")
      : true;
    return matchesName && matchesDate;
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
        </div>
        <div>
          <AdminUpcomingReservations 
            reservations={filteredReservations}
            onStatusChange={async (id: string, status: string) => {
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
            }}
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