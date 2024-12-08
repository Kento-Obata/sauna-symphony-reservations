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

const Admin = () => {
  const [showNewReservationDialog, setShowNewReservationDialog] = useState(false);
  const { data: reservations } = useReservations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const navigate = useNavigate();

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

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AdminCalendar 
            reservations={reservations} 
            onDateSelect={setSelectedDate}
          />
        </div>
        <div>
          <AdminUpcomingReservations reservations={reservations} />
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