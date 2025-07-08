import { useState } from "react";
import { ShiftCalendar } from "@/components/shift/ShiftCalendar";
import { ShiftExportDialog } from "@/components/shift/ShiftExportDialog";
import { HourlyRateManager } from "@/components/shift/HourlyRateManager";
import { SalaryCalculator } from "@/components/shift/SalaryCalculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Shift = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">シフト管理</h1>
        <ShiftExportDialog />
      </div>
      
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">カレンダー</TabsTrigger>
          <TabsTrigger value="rates">時給設定</TabsTrigger>
          <TabsTrigger value="salary">給与計算</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-6">
          <ShiftCalendar />
        </TabsContent>
        
        <TabsContent value="rates" className="space-y-6">
          <HourlyRateManager />
        </TabsContent>
        
        <TabsContent value="salary" className="space-y-6">
          <SalaryCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Shift;