
import { Option, ReservationOption } from "@/types/option";
import { useOptions } from "@/hooks/useOptions";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/utils/priceCalculations";

interface ReservationOptionsProps {
  selectedOptions: ReservationOption[];
  setSelectedOptions: (options: ReservationOption[]) => void;
  guestCount: number;
}

export const ReservationOptions = ({
  selectedOptions,
  setSelectedOptions,
  guestCount
}: ReservationOptionsProps) => {
  const { data: options, isLoading } = useOptions();

  const handleOptionChange = (optionId: string, checked: boolean) => {
    if (checked) {
      // オプションを追加
      setSelectedOptions([
        ...selectedOptions,
        { option_id: optionId, quantity: guestCount }
      ]);
    } else {
      // オプションを削除
      setSelectedOptions(
        selectedOptions.filter(option => option.option_id !== optionId)
      );
    }
  };

  if (isLoading || !options || options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">オプション</h3>
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = selectedOptions.some(
            (selected) => selected.option_id === option.id
          );

          return (
            <div
              key={option.id}
              className="flex items-start space-x-3 bg-sauna-wood/10 p-3 rounded-lg border border-sauna-stone/10"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) =>
                  handleOptionChange(option.id, checked === true)
                }
                id={`option-${option.id}`}
                className="mt-1"
              />
              <div className="flex-1">
                <label
                  htmlFor={`option-${option.id}`}
                  className="text-sm font-medium flex justify-between cursor-pointer"
                >
                  <span>{option.name}</span>
                  <span className="text-sauna-stone/80">
                    {formatPrice(option.price_per_person)} / 人
                  </span>
                </label>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                )}
                {isSelected && (
                  <p className="text-xs text-sauna-button mt-1">
                    合計: {formatPrice(option.price_per_person * guestCount)} ({guestCount}名様分)
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
