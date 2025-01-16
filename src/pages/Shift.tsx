import { useState } from "react";
import { ShiftCalendar } from "@/components/shift/ShiftCalendar";
import { AdminGuard } from "@/components/admin/AdminGuard";

const Shift = () => {
  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">シフト管理</h1>
        <ShiftCalendar />
      </div>
    </AdminGuard>
  );
};

export default Shift;