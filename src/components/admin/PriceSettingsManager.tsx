
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PriceSetting } from "@/types/price";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getGroupPrice } from "@/utils/priceCalculations";

export const PriceSettingsManager = () => {
  const [priceSettings, setPriceSettings] = useState<PriceSetting[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrices, setEditedPrices] = useState<PriceSetting[]>([]);

  const fetchPriceSettings = async () => {
    const { data, error } = await supabase
      .from("price_settings")
      .select("*")
      .order("guest_count");

    if (error) {
      toast.error("料金設定の取得に失敗しました");
      return;
    }

    setPriceSettings(data);
    setEditedPrices(data);
  };

  useEffect(() => {
    fetchPriceSettings();
  }, []);

  const handlePriceChange = (id: string, price: string) => {
    const numericPrice = parseInt(price.replace(/[^0-9]/g, ""));
    setEditedPrices((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? { ...setting, price_per_person: numericPrice || 0 }
          : setting
      )
    );
  };

  const calculateTotal = (guestCount: number) => {
    return getGroupPrice(guestCount);
  };

  const handleSave = async () => {
    // 一人当たりの料金を計算して保存 (グループ全体の料金をもとに)
    const updates = editedPrices.map(({ id, price_per_person, guest_count }) => {
      // 一人当たりの料金を計算 (グループ全体の料金 ÷ 人数)
      const perPersonPrice = Math.round(price_per_person / guest_count);
      return {
        id,
        price_per_person: perPersonPrice,
        guest_count
      };
    });

    const { error } = await supabase
      .from("price_settings")
      .upsert(updates);

    if (error) {
      toast.error("料金設定の更新に失敗しました");
      return;
    }

    toast.success("料金設定を更新しました");
    setIsEditing(false);
    fetchPriceSettings();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ja-JP").format(price);
  };

  // 現在の料金表を表示
  const currentPrices = [
    { guest_count: 2, total_price: 20000 },
    { guest_count: 3, total_price: 24000 },
    { guest_count: 4, total_price: 28000 },
    { guest_count: 5, total_price: 32000 },
    { guest_count: 6, total_price: 36000 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">料金設定</h2>
        <div className="space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setEditedPrices(priceSettings);
              }}>
                キャンセル
              </Button>
              <Button onClick={handleSave}>保存</Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>編集</Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        ※ 2024年4月以降の新規予約から適用される料金です。既存の予約には影響しません。
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>人数</TableHead>
            <TableHead>グループ料金</TableHead>
            <TableHead>一人当たり料金</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentPrices.map((price) => (
            <TableRow key={price.guest_count}>
              <TableCell>{price.guest_count}名</TableCell>
              <TableCell>
                {isEditing ? (
                  <Input
                    type="text"
                    value={formatPrice(price.total_price)}
                    onChange={(e) => {
                      const numericPrice = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                      const updatedPrices = [...currentPrices];
                      const index = updatedPrices.findIndex(p => p.guest_count === price.guest_count);
                      if (index >= 0) {
                        updatedPrices[index].total_price = numericPrice;
                      }
                    }}
                    className="w-32"
                  />
                ) : (
                  `¥${formatPrice(price.total_price)}`
                )}
              </TableCell>
              <TableCell>
                ¥{formatPrice(Math.round(price.total_price / price.guest_count))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
