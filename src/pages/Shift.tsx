import { ShiftCalendar } from "@/components/shift/ShiftCalendar";
import { ShiftExportDialog } from "@/components/shift/ShiftExportDialog";

const Shift = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">シフト管理</h1>
        <ShiftExportDialog />
      </div>
      <ShiftCalendar />
    </div>
  );
};

export default Shift;