import { format, parseISO } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface ShiftCellProps {
  shift: any;
  style: React.CSSProperties;
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
  color: string;
}

export const ShiftCell = ({ shift, style, onClick, onDelete, color }: ShiftCellProps) => {
  const startTime = parseISO(shift.start_time);
  const endTime = parseISO(shift.end_time);

  return (
    <div
      className={`absolute inset-x-0 px-1 py-0.5 ${color} rounded-sm cursor-pointer hover:brightness-95 group`}
      style={style}
      onClick={onClick}
    >
      <div className="text-[10px] whitespace-nowrap overflow-hidden text-ellipsis flex justify-between items-center">
        <span>
          {(shift.profiles as any)?.username}
          <span className="ml-1">
            {format(startTime, "HH:mm")}-{format(endTime, "HH:mm")}
          </span>
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3 text-red-500 hover:text-red-600" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>シフトを削除</AlertDialogTitle>
              <AlertDialogDescription>
                このシフトを削除してもよろしいですか？この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>削除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};