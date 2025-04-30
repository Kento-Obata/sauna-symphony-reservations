import { Option, ReservationOption } from "@/types/option";
import { useOptions } from "@/hooks/useOptions";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/utils/priceCalculations";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
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
  const {
    data: options,
    isLoading
  } = useOptions();
  const handleOptionChange = (optionId: string, checked: boolean) => {
    if (checked) {
      // オプションを追加 (初期数量は1に設定)
      setSelectedOptions([...selectedOptions, {
        option_id: optionId,
        quantity: 1
      }]);
    } else {
      // オプションを削除
      setSelectedOptions(selectedOptions.filter(option => option.option_id !== optionId));
    }
  };
  const handleQuantityChange = (optionId: string, change: number) => {
    const updatedOptions = selectedOptions.map(option => {
      if (option.option_id === optionId) {
        // 最小数量は1、最大数量はゲスト数
        const newQuantity = Math.min(Math.max(1, option.quantity + change), guestCount);
        return {
          ...option,
          quantity: newQuantity
        };
      }
      return option;
    });
    setSelectedOptions(updatedOptions);
  };

  // オプションの合計金額を計算
  const calculateTotalOptionPrice = () => {
    if (!options || !selectedOptions.length) return 0;
    return selectedOptions.reduce((total, selectedOption) => {
      const option = options.find(o => o.id === selectedOption.option_id);
      if (option) {
        return total + option.price_per_person * selectedOption.quantity;
      }
      return total;
    }, 0);
  };
  if (isLoading || !options || options.length === 0) {
    return null;
  }
  const totalOptionPrice = calculateTotalOptionPrice();
  return <div className="space-y-4">
      <h3 className="font-medium">オプション</h3>
      <div className="space-y-3">
        {options.map(option => {
        const selectedOption = selectedOptions.find(selected => selected.option_id === option.id);
        const isSelected = !!selectedOption;
        return <div key={option.id} className="flex items-start space-x-3 bg-sauna-wood/10 p-3 rounded-lg border border-sauna-stone/10">
              <Checkbox checked={isSelected} onCheckedChange={checked => handleOptionChange(option.id, checked === true)} id={`option-${option.id}`} className="mt-1" />
              <div className="flex-1">
                <label htmlFor={`option-${option.id}`} className="text-sm font-medium flex justify-between cursor-pointer">
                  <span>{option.name}</span>
                  <span className="text-sauna-stone/80">
                    {formatPrice(option.price_per_person)} / 人
                  </span>
                </label>
                {option.description && <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>}
                {isSelected && <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">数量:</span>
                      <div className="flex items-center space-x-2">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(option.id, -1)} disabled={selectedOption.quantity <= 1}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center text-sm">
                          {selectedOption.quantity}
                        </span>
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleQuantityChange(option.id, 1)} disabled={selectedOption.quantity >= guestCount}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-950">
                      合計: {formatPrice(option.price_per_person * selectedOption.quantity)}
                    </p>
                  </div>}
              </div>
            </div>;
      })}
      </div>
      
      {/* オプション合計金額の表示を追加 - 視認性を改善 */}
      {totalOptionPrice > 0 && <div className="mt-4 bg-sauna-stone/10 p-3 rounded-lg border border-sauna-stone/20">
          <div className="flex justify-between items-center">
            <span className="font-medium text-sm">オプション合計</span>
            <span className="font-bold text-sauna-button text-lg">
              {formatPrice(totalOptionPrice)}
            </span>
          </div>
        </div>}
    </div>;
};