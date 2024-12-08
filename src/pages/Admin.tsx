import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminUpcomingReservations } from "@/components/admin/AdminUpcomingReservations";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { AdminReservationDialog } from "@/components/admin/AdminReservationDialog";
import { useState } from "react";
import { useReservations } from "@/hooks/useReservations";

const Admin = () => {
  const navigate = useNavigate();
  const [showNewReservationDialog, setShowNewReservationDialog] = useState(false);
  const { data: reservations } = useReservations();

  // TODO: Implement proper auth check
  useEffect(() => {
    // Temporary: redirect to home if not admin
    // This should be replaced with proper auth check
    navigate("/");
  }, [navigate]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">予約管理</h1>
        <Button 
          onClick={() => setShowNewReservationDialog(true)}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          新規予約
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AdminCalendar reservations={reservations} />
        </div>
        <div>
          <AdminUpcomingReservations reservations={reservations} />
        </div>
      </div>

      <AdminReservationDialog
        open={showNewReservationDialog}
        onOpenChange={setShowNewReservationDialog}
      />
    </div>
  );
};

export default Admin;