import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const HourlyRateManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [weekdayRate, setWeekdayRate] = useState<string>("1300");
  const [weekendRate, setWeekendRate] = useState<string>("1450");

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("role", ["staff", "admin"]);

      if (error) throw error;
      return data;
    },
  });

  const { data: hourlyRates } = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_hourly_rates")
        .select("*, profiles(username)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!selectedStaffId) {
      toast({
        title: "エラー",
        description: "スタッフを選択してください",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("staff_hourly_rates")
        .upsert({
          staff_id: selectedStaffId,
          weekday_rate: parseInt(weekdayRate),
          weekend_rate: parseInt(weekendRate),
        }, {
          onConflict: "staff_id"
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "時給設定を保存しました",
      });

      queryClient.invalidateQueries({ queryKey: ["hourly-rates"] });
      setSelectedStaffId("");
      setWeekdayRate("1300");
      setWeekendRate("1450");
    } catch (error) {
      console.error("Error saving hourly rate:", error);
      toast({
        title: "エラー",
        description: "時給設定の保存に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>時給設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="staff">スタッフ</Label>
              <select
                id="staff"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">スタッフを選択</option>
                {staffMembers?.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.username}
                  </option>
                ))}
              </select>
            </div>
            <div></div>
            <div>
              <Label htmlFor="weekday-rate">平日時給（円）</Label>
              <Input
                id="weekday-rate"
                type="number"
                value={weekdayRate}
                onChange={(e) => setWeekdayRate(e.target.value)}
                placeholder="1300"
              />
            </div>
            <div>
              <Label htmlFor="weekend-rate">土日時給（円）</Label>
              <Input
                id="weekend-rate"
                type="number"
                value={weekendRate}
                onChange={(e) => setWeekendRate(e.target.value)}
                placeholder="1450"
              />
            </div>
          </div>
          <Button onClick={handleSave}>保存</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>設定済み時給一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {hourlyRates?.map((rate) => (
              <div key={rate.id} className="flex justify-between items-center p-2 border rounded">
                <span>{(rate.profiles as any)?.username}</span>
                <div className="text-sm text-gray-600">
                  平日: ¥{rate.weekday_rate} | 土日: ¥{rate.weekend_rate}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};