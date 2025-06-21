import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlusCircle, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminReservationDialog } from "@/components/admin/AdminReservationDialog";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminUpcomingReservations } from "@/components/admin/AdminUpcomingReservations";
import { AdminSearchResults } from "@/components/admin/AdminSearchResults";
import { ShopClosureManager } from "@/components/admin/ShopClosureManager";
import { PriceSettingsManager } from "@/components/admin/PriceSettingsManager";
import { OptionManager } from "@/components/admin/OptionManager";
import { AvailabilityTextGenerator } from "@/components/admin/AvailabilityTextGenerator";
import { CustomerManagement } from "@/components/admin/CustomerManagement";
import { useReservations } from "@/hooks/useReservations";

const Admin = () => {
  const [showNewReservationDialog, setShowNewReservationDialog] = useState(false);
  const { data: reservations } = useReservations();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const navigate = useNavigate();
  const [nameQuery, setNameQuery] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [dateQuery, setDateQuery] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("reservations");
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

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

  const handleStatusChange = async (id: string, status: string, isConfirmed = true) => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ 
          status,
          is_confirmed: isConfirmed
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("予約状態を更新しました");
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("予約状態の更新に失敗しました");
    }
  };

  const handleCustomerDetailClick = (userKey: string) => {
    setSelectedUserKey(userKey);
    setActiveTab("customers");
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
        <h1 className="text-3xl font-bold">管理者画面</h1>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="reservations">予約管理</TabsTrigger>
          <TabsTrigger value="customers">顧客管理</TabsTrigger>
          <TabsTrigger value="availability">空き状況</TabsTrigger>
          <TabsTrigger value="closures">休業管理</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="space-y-6">
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
                onCustomerDetailClick={handleCustomerDetailClick}
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
                onCustomerDetailClick={handleCustomerDetailClick}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <CustomerManagement 
            initialUserKey={selectedUserKey}
            onUserKeyChange={setSelectedUserKey}
          />
        </TabsContent>

        <TabsContent value="availability" className="space-y-6">
          <AvailabilityTextGenerator reservations={reservations} />
        </TabsContent>

        <TabsContent value="closures" className="space-y-6">
          <ShopClosureManager />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="space-y-8">
            <PriceSettingsManager />
            <OptionManager />
          </div>
        </TabsContent>
      </Tabs>

      <AdminReservationDialog
        open={showNewReservationDialog}
        onOpenChange={setShowNewReservationDialog}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default Admin;
