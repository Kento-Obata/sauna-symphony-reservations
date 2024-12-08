import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { ja } from "date-fns/locale";
import { format } from "date-fns";
import TimeSlotSelect from "./TimeSlotSelect";
import ReservationConfirmDialog from "./ReservationConfirmDialog";
import ReservationStatus from "./ReservationStatus";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "./ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  guestName: z.string().min(1, "お名前を入力してください"),
  guestCount: z.number().min(1).max(4),
  email: z.string().email("正しいメールアドレスを入力してください"),
  phone: z.string().min(1, "電話番号を入力してください"),
  waterTemperature: z.number().min(2).max(17),
});

const ReservationForm = () => {
  const [date, setDate] = useState<Date>();
  const [timeSlot, setTimeSlot] = useState<string>();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      guestName: "",
      guestCount: 1,
      email: "",
      phone: "",
      waterTemperature: 10,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!date || !timeSlot) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "日時を選択してください",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  return (
    <div className="glass-card p-8 animate-fade-up">
      <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
        ご予約
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>予約日</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              locale={ja}
              fromDate={new Date()}
            />
          </div>

          {date && (
            <div className="space-y-2 animate-fade-up">
              <Label>時間帯</Label>
              <TimeSlotSelect
                date={date}
                selected={timeSlot}
                onSelect={setTimeSlot}
              />
            </div>
          )}

          {date && <ReservationStatus date={date} />}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>お名前</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guestCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>人数</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電話番号</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="waterTemperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>水温設定 (2℃ ~ 17℃)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={2}
                      max={17}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={!date || !timeSlot}
            >
              予約内容を確認
            </Button>
          </form>
        </Form>
      </div>

      <ReservationConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        date={date}
        timeSlot={timeSlot}
        formData={form.getValues()}
        onConfirm={async () => {
          const values = form.getValues();
          if (!date || !timeSlot) return;

          try {
            const { error } = await supabase.from("reservations").insert({
              date: format(date, "yyyy-MM-dd"),
              time_slot: timeSlot,
              guest_name: values.guestName,
              guest_count: values.guestCount,
              email: values.email,
              phone: values.phone,
              water_temperature: values.waterTemperature,
            });

            if (error) throw error;

            toast({
              title: "予約を受け付けました",
              description: "ご予約ありがとうございます。",
            });

            // Reset form
            form.reset();
            setDate(undefined);
            setTimeSlot(undefined);
          } catch (error) {
            console.error("Error creating reservation:", error);
            toast({
              variant: "destructive",
              title: "エラー",
              description: "予約の作成に失敗しました。",
            });
          }
        }}
      />
    </div>
  );
};

export default ReservationForm;