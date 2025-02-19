
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

  const calculateTotal = (guestCount: number, pricePerPerson: number) => {
    return guestCount * pricePerPerson;
  };

  const handleSave = async () => {
    const updates = editedPrices.map(({ id, price_per_person }) => ({
      id,
      price_per_person,
    }));

    const { error } = await supabase
      .from("price_settings")
      .upsert(updates, { onConflict: "id" });

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>人数</TableHead>
            <TableHead>一人当たり料金</TableHead>
            <TableHead>合計金額</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(isEditing ? editedPrices : priceSettings).map((setting) => (
            <TableRow key={setting.id}>
              <TableCell>{setting.guest_count}名</TableCell>
              <TableCell>
                {isEditing ? (
                  <Input
                    type="text"
                    value={formatPrice(setting.price_per_person)}
                    onChange={(e) => handlePriceChange(setting.id, e.target.value)}
                    className="w-32"
                  />
                ) : (
                  `¥${formatPrice(setting.price_per_person)}`
                )}
              </TableCell>
              <TableCell>
                ¥{formatPrice(calculateTotal(setting.guest_count, setting.price_per_person))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
