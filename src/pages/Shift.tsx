import { ShiftCalendar } from "@/components/shift/ShiftCalendar";
import { ShiftGuard } from "@/components/shift/ShiftGuard";

const Shift = () => {
  return (
    <ShiftGuard>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">シフト管理</h1>
        <ShiftCalendar />
      </div>
    </ShiftGuard>
  );
};

export default Shift;