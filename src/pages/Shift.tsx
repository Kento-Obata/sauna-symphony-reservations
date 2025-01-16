import { ShiftCalendar } from "@/components/shift/ShiftCalendar";

const Shift = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">シフト管理</h1>
      <ShiftCalendar />
    </div>
  );
};

export default Shift;