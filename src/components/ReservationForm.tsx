import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { TimeSlot, ReservationFormData } from "@/types/reservation";
import { ReservationConfirmDialog } from "@/components/ReservationConfirmDialog";
import { useState } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { sendReservationData } from "@/integrations/supabase/utils";
import { formatPrice } from "@/utils/priceCalculations";
import { useEffect } from 'react';

const timeSlotOptions = [
  { value: "morning", label: "午前" },
  { value: "afternoon", label: "午後" },
  { value: "evening", label: "夜" },
];

const formSchema = z.object({
  date: z.date({
    required_error: "日付を選択してください",
  }),
  time_slot: z.enum(["morning", "afternoon", "evening"], {
    required_error: "時間帯を選択してください",
  }),
  guest_name: z.string().min(2, {
    message: "お名前は2文字以上で入力してください",
  }),
  email: z.string().email("正しいメールアドレスを入力してください").optional().or(z.literal("")),
  phone: z.string().regex(/^0\d{9,10}$/, "正しい電話番号を入力してください"),
  guest_count: z.number().min(1, {
    message: "1名以上を入力してください",
  }),
  water_temperature: z.number(),
});

const ReservationForm = () => {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationData, setReservationData] = useState<ReservationFormData | null>(null);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [temperature, setTemperature] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const reservationCode = searchParams.get('code');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      time_slot: "morning",
      guest_name: "",
      email: "",
      phone: "",
      guest_count: 1,
      water_temperature: 18,
    },
  });

  useEffect(() => {
    const initialTemperature = form.watch("water_temperature").toString();
    setTemperature(initialTemperature);
  }, [form.watch("water_temperature")]);

  const handleTemperatureChange = (value: string) => {
    form.setValue("water_temperature", parseInt(value));
    setTemperature(value);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setReservationData(values);
    setIsConfirmDialogOpen(true);

    try {
      const response = await fetch('/api/calculate-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guestCount: values.guest_count,
          waterTemperature: values.water_temperature,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      setTotalPrice(data.totalPrice);
    } catch (error) {
      console.error('Failed to calculate total price:', error);
    }
  };

  const confirmReservation = async () => {
    if (!reservationData) return;

    setIsSubmitting(true);
    try {
      const reservationCode = await sendReservationData(reservationData);
      setIsConfirmDialogOpen(false);
      router.push(`/complete?code=${reservationCode}`);
    } catch (error) {
      console.error("予約エラー:", error);
      alert("予約処理中にエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const editReservation = () => {
    setIsConfirmDialogOpen(false);
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <div className="glass-card p-8">
        <h2 className="text-3xl font-mplus font-extralight mb-8 text-center text-gradient">
          Reservation
        </h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-left">日付</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "yyyy-MM-dd")
                          ) : (
                            <span>日付を選択</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date()
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time_slot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left">時間帯</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder="時間帯を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlotOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guest_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left">お名前</FormLabel>
                  <FormControl>
                    <Input placeholder="お名前" {...field} />
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
                  <FormLabel className="text-left">メールアドレス (任意)</FormLabel>
                  <FormControl>
                    <Input placeholder="メールアドレス" {...field} type="email" />
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
                  <FormLabel className="text-left">電話番号</FormLabel>
                  <FormControl>
                    <Input placeholder="電話番号" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guest_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left">人数</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="人数"
                      type="number"
                      {...field}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="water_temperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left">水風呂温度</FormLabel>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="1"
                      value={temperature || "18"}
                      onChange={(e) => handleTemperatureChange(e.target.value)}
                      className="w-full"
                    />
                    <span className="w-10 text-center">{temperature || "18"}℃</span>
                  </div>
                </FormItem>
              )}
            />

            <div className="text-center mt-8">
              <div className="mb-4">
                <p className="text-lg font-semibold text-black">料金</p>
                <p className="text-2xl font-bold text-black">{formatPrice(totalPrice)}</p>
                {temperature && parseInt(temperature) <= 7 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ※ 水温7℃以下のオプション料金 +¥5,000を含む
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full md:w-auto hover-lift bg-sauna-button hover:bg-sauna-button/90">
                予約する
              </Button>
            </div>
          </form>
        </Form>
      </div>
      <ReservationConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={confirmReservation}
        onEdit={editReservation}
        reservation={reservationData || form.getValues()}
        isSubmitting={isSubmitting}
        reservationCode={reservationCode || undefined}
      />
    </section>
  );
};

export default ReservationForm;
