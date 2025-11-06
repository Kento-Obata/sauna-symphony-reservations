import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Reservation, TimeSlot } from "@/types/reservation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ReservationDateSelect } from "./reservation-details/ReservationDateSelect";
import { ReservationTimeSelect } from "./reservation-details/ReservationTimeSelect";
import { ReservationMemoEditor } from "./ReservationMemoEditor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle, List, Plus, Minus, Trash, User, MessageSquare } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Option } from "@/types/option";

interface AdminReservationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onCustomerDetailClick?: (userKey: string) => void;
}

export const AdminReservationDetailsDialog = ({
  open,
  onOpenChange,
  reservation,
  onCustomerDetailClick,
}: AdminReservationDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [waterTemperature, setWaterTemperature] = useState("15");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("morning");
  const [date, setDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [reservationOptions, setReservationOptions] = useState<{option: Option, quantity: number, total_price?: number}[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [availableOptions, setAvailableOptions] = useState<Option[]>([]);
  const [isDirty, setIsDirty] = useState(false); // Track if options or price have been modified

  // Fetch all available options
  useEffect(() => {
    const fetchAvailableOptions = async () => {
      const { data, error } = await supabase
        .from("options")
        .select("*")
        .eq("is_active", true);
      
      if (error) {
        console.error("Error fetching available options:", error);
      } else if (data) {
        setAvailableOptions(data);
      }
    };

    fetchAvailableOptions();
  }, []);

  useEffect(() => {
    if (reservation) {
      setGuestName(reservation.guest_name);
      setGuestCount(reservation.guest_count.toString());
      setPhone(reservation.phone);
      setEmail(reservation.email || "");
      setWaterTemperature(reservation.water_temperature.toString());
      setTimeSlot(reservation.time_slot);
      setDate(reservation.date);
      setTotalPrice(reservation.total_price);
      fetchReservationOptions(reservation.id);
    }
  }, [reservation]);

  const fetchReservationOptions = async (reservationId: string) => {
    try {
      console.log("Fetching options for reservation ID:", reservationId);
      
      const { data, error } = await supabase
        .from("reservation_options")
        .select(`
          quantity,
          option_id,
          total_price,
          options(
            id, name, description, price_per_person, pricing_type, flat_price, is_active, created_at, updated_at
          )
        `)
        .eq("reservation_id", reservationId);

      if (error) {
        console.error("Error fetching reservation options:", error);
        return;
      }

      if (data && data.length > 0) {
        const formattedOptions = data
          .filter(item => item.options) // Filter out any null options
          .map(item => ({
            option: item.options as Option,
            quantity: item.quantity,
            total_price: item.total_price // Include stored total_price
          }));
        setReservationOptions(formattedOptions);
        
        // Calculate base price by subtracting options total from total price
        // Use the stored total_price from database instead of recalculating
        const optionsTotal = formattedOptions.reduce((total, item) => {
          return total + (item.total_price || 0);
        }, 0);
        
        setBasePrice(reservation?.total_price ? reservation.total_price - optionsTotal : 0);
        console.log("Formatted options:", formattedOptions);
        console.log("Options total (from DB):", optionsTotal);
        console.log("Base price set to:", reservation?.total_price ? reservation.total_price - optionsTotal : 0);
      } else {
        setReservationOptions([]);
        // If no options, base price is the total price
        setBasePrice(reservation?.total_price || 0);
        console.log("No options found for this reservation");
        console.log("Base price set to total:", reservation?.total_price);
      }
    } catch (error) {
      console.error("Error in fetchReservationOptions:", error);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return "仮予約";
      case "confirmed":
        return "予約確定";
      case "cancelled":
        return "キャンセル済み";
      default:
        return status;
    }
  };

  // Calculate total options price
  const calculateOptionsTotal = () => {
    return reservationOptions.reduce((total, item) => {
      // Use stored total_price if available, otherwise calculate
      if (item.total_price !== undefined) {
        return total + item.total_price;
      }
      // Fallback calculation for new options being added
      if (item.option.pricing_type === 'flat') {
        return total + (item.option.flat_price || 0);
      } else if (item.option.pricing_type === 'per_guest') {
        return total + (item.option.price_per_person * parseInt(guestCount));
      } else {
        return total + (item.option.price_per_person * item.quantity);
      }
    }, 0);
  };

  // Update total price when base price or options change
  useEffect(() => {
    const newTotal = basePrice + calculateOptionsTotal();
    setTotalPrice(newTotal);
  }, [basePrice, reservationOptions]);

  // Handle base price change
  const handleBasePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBasePrice = parseInt(e.target.value) || 0;
    setBasePrice(newBasePrice);
    setIsDirty(true);
  };

  // Handle adding an option
  const handleAddOption = () => {
    if (!availableOptions || availableOptions.length === 0) return;
    
    // Add first available option by default
    const newOption = {
      option: availableOptions[0],
      quantity: 1
    };
    
    setReservationOptions([...reservationOptions, newOption]);
    setIsDirty(true);
  };

  // Handle removing an option
  const handleRemoveOption = (index: number) => {
    const updatedOptions = [...reservationOptions];
    updatedOptions.splice(index, 1);
    setReservationOptions(updatedOptions);
    setIsDirty(true);
  };

  // Handle changing an option
  const handleOptionChange = (index: number, optionId: string) => {
    const option = availableOptions?.find(opt => opt.id === optionId);
    if (!option) return;
    
    const updatedOptions = [...reservationOptions];
    updatedOptions[index] = {
      ...updatedOptions[index],
      option
    };
    
    setReservationOptions(updatedOptions);
    setIsDirty(true);
  };

  // Handle changing quantity
  const handleQuantityChange = (index: number, change: number) => {
    const updatedOptions = [...reservationOptions];
    const currentOption = updatedOptions[index];
    const newQuantity = Math.max(1, currentOption.quantity + change);
    
    // Limit to guest count if applicable
    const guestCountNum = parseInt(guestCount);
    const maxQuantity = !isNaN(guestCountNum) ? guestCountNum : 6;
    
    updatedOptions[index] = {
      ...currentOption,
      quantity: Math.min(newQuantity, maxQuantity)
    };
    
    setReservationOptions(updatedOptions);
    setIsDirty(true);
  };

  const generateUserKey = (phone: string) => {
    return phone.replace(/\D/g, ''); // Remove non-digit characters to create user_key
  };

  const handleCustomerDetailNavigation = () => {
    if (onCustomerDetailClick && reservation) {
      const userKey = generateUserKey(reservation.phone);
      onCustomerDetailClick(userKey);
      onOpenChange(false); // Close the dialog
    }
  };

  if (!reservation) return null;

  const handleSave = async () => {
    try {
      console.log("Updating reservation with data:", {
        guest_name: guestName,
        guest_count: parseInt(guestCount),
        phone: phone,
        email: email || null,
        water_temperature: 15,
        time_slot: timeSlot,
        date: date,
        total_price: totalPrice,
      });

      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: guestName,
          guest_count: parseInt(guestCount),
          phone: phone,
          email: email || null,
          water_temperature: 15,
          time_slot: timeSlot,
          date: date,
          total_price: totalPrice, // Save the updated total price
        })
        .eq("id", reservation.id);

      if (error) {
        console.error("Error updating reservation:", error);
        throw error;
      }

      // If options have been modified, update them too
      if (isDirty) {
        // First delete all existing options
        const { error: deleteError } = await supabase
          .from("reservation_options")
          .delete()
          .eq("reservation_id", reservation.id);
          
        if (deleteError) {
          console.error("Error deleting existing options:", deleteError);
          throw deleteError;
        }
        
        // Then insert the new ones if there are any
        if (reservationOptions.length > 0) {
          const optionsToInsert = reservationOptions.map(item => {
            // Calculate total_price based on pricing_type
            let total_price: number;
            if (item.option.pricing_type === 'flat') {
              total_price = item.option.flat_price || 0;
            } else {
              total_price = item.option.price_per_person * item.quantity;
            }

            return {
              reservation_id: reservation.id,
              option_id: item.option.id,
              quantity: item.quantity,
              total_price
            };
          });
          
          const { error: insertError } = await supabase
            .from("reservation_options")
            .insert(optionsToInsert);
            
          if (insertError) {
            console.error("Error inserting new options:", insertError);
            throw insertError;
          }
        }
      }

      const notificationResponse = await supabase.functions.invoke(
        "send-update-notification",
        {
          body: {
            date: date,
            timeSlot: timeSlot,
            guestName: guestName,
            guestCount: parseInt(guestCount),
            email: email || null,
            phone: phone,
            waterTemperature: 15,
            reservationCode: reservation.reservation_code,
          },
        }
      );

      if (notificationResponse.error) {
        console.error("通知の送信に失敗しました:", notificationResponse.error);
        toast.error("予約は更新されましたが、通知の送信に失敗しました");
      } else {
        toast.success("予約情報を更新しました");
      }

      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      await queryClient.invalidateQueries({ 
        queryKey: ["reservation", reservation.reservation_code] 
      });
      
      setIsEditing(false);
      setIsDirty(false);
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error("予約情報の更新に失敗しました");
    }
  };

  const handleCancel = async () => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ 
          status: "cancelled",
          is_confirmed: true // キャンセル時には is_confirmed を true に設定
        })
        .eq("id", reservation.id);

      if (error) throw error;

      toast.success("予約をキャンセルしました");
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      toast.error("予約のキャン��ルに失敗しました");
    }
  };

  const handleDateChange = (newDate: Date) => {
    setDate(format(newDate, "yyyy-MM-dd"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>予約詳細</span>
            {onCustomerDetailClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomerDetailNavigation}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                顧客詳細
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
            <ReservationDateSelect
              date={date}
              onDateChange={handleDateChange}
              isEditing={isEditing}
              currentReservationId={reservation.id}
            />

            <ReservationTimeSelect
              timeSlot={timeSlot}
              onTimeSlotChange={setTimeSlot}
              isEditing={isEditing}
              date={date}
              currentReservationId={reservation.id}
            />

            <div className="text-muted-foreground">お名前:</div>
            <div>
              {isEditing ? (
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              ) : (
                `${reservation.guest_name}様`
              )}
            </div>

            <div className="text-muted-foreground">人数:</div>
            <div>
              {isEditing ? (
                <Select value={guestCount} onValueChange={setGuestCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}名
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                `${reservation.guest_count}名`
              )}
            </div>

            <div className="text-muted-foreground">電話番号:</div>
            <div>
              {isEditing ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              ) : (
                reservation.phone
              )}
            </div>

            <div className="text-muted-foreground">メールアドレス:</div>
            <div>
              {isEditing ? (
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              ) : (
                reservation.email || "-"
              )}
            </div>

            <div className="text-muted-foreground">水風呂温度:</div>
            <div>
              {isEditing ? (
                <>
                  <div className="text-sm text-muted-foreground mb-2 text-amber-600 font-medium">
                    ※ 水温選択は2025年9月より導入予定です
                  </div>
                  <Select value="15" onValueChange={setWaterTemperature} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15°C</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                `${reservation.water_temperature}°C`
              )}
            </div>

            {/* Price editor - only visible when editing */}
            {isEditing && (
              <>
                <div className="text-muted-foreground">基本料金:</div>
                <div>
                  <Input 
                    type="number" 
                    value={basePrice} 
                    onChange={handleBasePriceChange} 
                    className="w-32"
                  />
                </div>
              </>
            )}
            
            {/* Options section */}
            <div className="text-muted-foreground">選択オプション:</div>
            <div>
              {isEditing ? (
                <div className="space-y-3">
                  {/* Option list */}
                  {reservationOptions.length > 0 ? (
                    <ul className="space-y-2">
                      {reservationOptions.map((item, index) => (
                        <li key={index} className="bg-sauna-wood/10 p-2 rounded-lg border border-sauna-stone/10">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <Select
                                value={item.option.id}
                                onValueChange={(value) => handleOptionChange(index, value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableOptions?.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name} (
                                        {option.pricing_type === 'flat' 
                                          ? `${formatPrice(option.flat_price || 0)}・一律`
                                          : `${formatPrice(option.price_per_person)}/人`
                                        })
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex items-center ml-2 gap-1">
                              {item.option.pricing_type === 'per_person' && (
                                <>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7" 
                                    onClick={() => handleQuantityChange(index, -1)}
                                    disabled={item.quantity <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-5 text-center">{item.quantity}</span>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleQuantityChange(index, 1)}
                                    disabled={item.quantity >= parseInt(guestCount)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 ml-1" 
                                onClick={() => handleRemoveOption(index)}
                              >
                                <Trash className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs mt-1">
                            小計: {formatPrice(
                              item.option.pricing_type === 'flat' 
                                ? (item.option.flat_price || 0)
                                : item.option.price_per_person * item.quantity
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">選択されているオプションはありません</p>
                  )}
                  
                  {/* Add option button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleAddOption}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    オプションを追加
                  </Button>
                  
                  {/* Total options price */}
                  {reservationOptions.length > 0 && (
                    <div className="bg-sauna-stone/10 p-2 rounded-lg mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">オプション合計</span>
                        <span className="font-bold">
                          {formatPrice(calculateOptionsTotal())}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                reservationOptions.length > 0 ? (
                  <ul className="space-y-2">
                    {reservationOptions.map((item, index) => (
                      <li key={index} className="bg-sauna-wood/10 p-2 rounded-lg border border-sauna-stone/10">
                        <div className="font-medium text-sm">{item.option.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(item.option.price_per_person)}/人 × {item.quantity}人 = {formatPrice(item.option.price_per_person * item.quantity)}
                        </div>
                        {item.option.description && (
                          <div className="text-xs text-muted-foreground mt-1">{item.option.description}</div>
                        )}
                      </li>
                    ))}
                    <div className="mt-2 bg-sauna-stone/10 p-2 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">オプション合計</span>
                        <span className="font-bold">
                          {formatPrice(calculateOptionsTotal())}
                        </span>
                      </div>
                    </div>
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">選択されているオプションはありません</p>
                )
              )}
            </div>

            <div className="text-muted-foreground">予約コード:</div>
            <div>{reservation.reservation_code}</div>

            <div className="text-muted-foreground">ステータス:</div>
            <div>
              {getStatusDisplay(reservation.status)}
            </div>

            <div className="text-muted-foreground">料金:</div>
            <div>
              {isEditing ? (
                <div className="bg-sauna-stone/10 p-2 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">合計金額</span>
                    <span className="font-bold text-lg">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {formatPrice(reservation.total_price)} (税込)
                  {basePrice > 0 && reservationOptions.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      内訳: 基本料金 {formatPrice(basePrice)} + オプション {formatPrice(calculateOptionsTotal())}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 管理者メモセクション */}
          {!isEditing && (
            <div className="mt-6">
              <ReservationMemoEditor 
                reservationId={reservation.id}
                currentMemo={reservation.admin_memo}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSave}>保存</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      予約をキャンセル
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消すことができません。予約をキャンセルしてもよろしいですか？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>戻る</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        キャンセルする
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>編集</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
