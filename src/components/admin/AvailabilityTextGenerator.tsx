
import React, { useState } from "react";
import { addWeeks, subWeeks, format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { generateAvailabilityText, getMondayOfWeek } from "@/utils/availabilityUtils";
import { Reservation } from "@/types/reservation";
import { useShopClosures } from "@/hooks/useShopClosures";
import { toast } from "sonner";

interface AvailabilityTextGeneratorProps {
  reservations?: Reservation[];
}

export const AvailabilityTextGenerator = ({ reservations = [] }: AvailabilityTextGeneratorProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMondayOfWeek(new Date()));
  const [copied, setCopied] = useState(false);
  const { closures: shopClosures } = useShopClosures();
  
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const handleThisWeek = () => setCurrentWeekStart(getMondayOfWeek(new Date()));
  
  const availabilityText = generateAvailabilityText(currentWeekStart, reservations, shopClosures);
  
  const handleCopyText = () => {
    navigator.clipboard.writeText(availabilityText)
      .then(() => {
        setCopied(true);
        toast.success("テキストをコピーしました");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => {
        console.error("テキストのコピーに失敗しました:", error);
        toast.error("テキストのコピーに失敗しました");
      });
  };
  
  const weekDisplayText = `${format(currentWeekStart, "yyyy年MM月dd日", { locale: ja })} - ${format(
    addWeeks(currentWeekStart, 1),
    "MM月dd日",
    { locale: ja }
  )}`;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>空き枠情報(SNS投稿用)</CardTitle>
        <CardDescription>選択した週の空き枠情報を生成します</CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center">
            <span className="font-medium">{weekDisplayText}</span>
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleThisWeek}
              className="ml-2"
            >
              今週
            </Button>
          </div>
          
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Separator className="my-4" />
        
        <Textarea
          className="h-56 font-mono text-sm"
          readOnly
          value={availabilityText}
        />
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleCopyText}
          className="ml-auto"
          variant={copied ? "outline" : "default"}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              コピー完了
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              テキストをコピー
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
