import { useState, useEffect } from "react";
import { ShiftCalendar } from "@/components/shift/ShiftCalendar";
import { ShiftExportDialog } from "@/components/shift/ShiftExportDialog";
import { HourlyRateManager } from "@/components/shift/HourlyRateManager";
import { SalaryCalculator } from "@/components/shift/SalaryCalculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const Shift = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
    };

    checkAdminRole();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">シフト管理</h1>
        <ShiftExportDialog />
      </div>
      
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="calendar">カレンダー</TabsTrigger>
          <TabsTrigger value="rates">時給設定</TabsTrigger>
          {isAdmin && <TabsTrigger value="salary">給与計算</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-6">
          <ShiftCalendar />
        </TabsContent>
        
        <TabsContent value="rates" className="space-y-6">
          <HourlyRateManager />
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="salary" className="space-y-6">
            <SalaryCalculator />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Shift;