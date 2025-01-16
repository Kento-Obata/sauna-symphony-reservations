import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface AdminSearchBarProps {
  nameQuery: string;
  setNameQuery: (query: string) => void;
  phoneQuery: string;
  setPhoneQuery: (query: string) => void;
  dateQuery: Date | undefined;
  setDateQuery: (date: Date | undefined) => void;
  onClearFilters: () => void;
}

export const AdminSearchBar = ({
  nameQuery,
  setNameQuery,
  phoneQuery,
  setPhoneQuery,
  dateQuery,
  setDateQuery,
  onClearFilters,
}: AdminSearchBarProps) => {
  return (
    <div className="flex gap-4 items-center mb-6">
      <div className="flex-1 basis-0">
        <Input
          placeholder="お客様名で検索"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex-1 basis-0">
        <Input
          placeholder="電話番号で検索"
          value={phoneQuery}
          onChange={(e) => setPhoneQuery(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex-1 basis-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={dateQuery ? "default" : "outline"}
              className="w-full justify-start text-left font-normal"
            >
              {dateQuery ? (
                format(dateQuery, "yyyy年MM月dd日", { locale: ja })
              ) : (
                <span>日付で検索</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateQuery}
              onSelect={setDateQuery}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {(nameQuery || phoneQuery || dateQuery) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFilters}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};