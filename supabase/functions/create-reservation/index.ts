import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateReservationRequest {
  date: string;
  timeSlot: string;
  guestName: string;
  guestCount: number;
  email?: string;
  phone: string;
  waterTemperature: number;
  selectedOptions: Array<{
    option_id: string;
    quantity: number;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Create reservation function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const body: CreateReservationRequest = await req.json();
    const { date, timeSlot, guestName, guestCount, email, phone, waterTemperature, selectedOptions } = body;

    // Validate required fields
    if (!date || !timeSlot || !guestName || !guestCount || !phone) {
      return new Response(
        JSON.stringify({ error: "必須項目が入力されていません" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Format validations
    const errors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("日付の形式が正しくありません");
    if (!['morning', 'afternoon', 'evening', 'night'].includes(timeSlot)) errors.push("時間帯が不正です");
    if (typeof guestName !== 'string' || guestName.trim().length === 0 || guestName.length > 100) {
      errors.push("お名前は1〜100文字で入力してください");
    }
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
      errors.push("人数が不正です");
    }
    // Phone: digits/hyphens, 10-15 chars total, at least 10 digits
    const phoneStr = String(phone);
    const phoneDigits = phoneStr.replace(/[^\d]/g, '');
    if (!/^[\d\-+()\s]{10,20}$/.test(phoneStr) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      errors.push("電話番号の形式が正しくありません");
    }
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("メールアドレスの形式が正しくありません");
      }
    }
    if (!Number.isInteger(waterTemperature) || waterTemperature < 0 || waterTemperature > 100) {
      errors.push("水温が不正です");
    }
    if (selectedOptions && !Array.isArray(selectedOptions)) {
      errors.push("オプションの形式が不正です");
    }
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: errors.join(' / ') }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Creating reservation for:", { date, timeSlot, guestName, guestCount });

    // Use service role key to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Check availability
    const { data: existingReservations, error: checkError } = await supabase
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("time_slot", timeSlot)
      .eq("status", "confirmed");

    if (checkError) {
      console.error("Error checking availability:", checkError);
      throw checkError;
    }

    if (existingReservations && existingReservations.length > 0) {
      return new Response(
        JSON.stringify({ error: "この時間帯はすでに予約が入っています" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409 
        }
      );
    }

    // Step 2: Calculate total price
    let basePrice = 0;
    
    // Get price setting for guest count
    const { data: priceSettings, error: priceError } = await supabase
      .from("price_settings")
      .select("*")
      .eq("guest_count", guestCount)
      .single();

    if (priceError) {
      console.error("Error fetching price:", priceError);
      // Use default price if not found
      basePrice = guestCount * 3000;
    } else {
      basePrice = priceSettings.price_per_person * guestCount;
    }

    // Calculate options total price
    let optionsTotalPrice = 0;
    const reservationOptionsData: Array<{
      option_id: string;
      quantity: number;
      total_price: number;
    }> = [];

    if (selectedOptions && selectedOptions.length > 0) {
      // Fetch option details
      const { data: optionsData, error: optionsError } = await supabase
        .from("options")
        .select("*")
        .in("id", selectedOptions.map(o => o.option_id));

      if (optionsError) {
        console.error("Error fetching options:", optionsError);
        throw optionsError;
      }

      for (const selectedOption of selectedOptions) {
        const optionData = optionsData?.find(o => o.id === selectedOption.option_id);
        if (!optionData) continue;

        const effectiveQuantity = optionData.pricing_type === 'per_guest' 
          ? guestCount 
          : selectedOption.quantity;
        
        let optionPrice: number;
        if (optionData.pricing_type === 'flat') {
          optionPrice = optionData.flat_price || 0;
        } else {
          optionPrice = optionData.price_per_person * effectiveQuantity;
        }

        optionsTotalPrice += optionPrice;
        
        reservationOptionsData.push({
          option_id: selectedOption.option_id,
          quantity: effectiveQuantity,
          total_price: optionPrice
        });
      }
    }

    const totalPrice = basePrice + optionsTotalPrice;
    console.log("Calculated total price:", totalPrice, "Base:", basePrice, "Options:", optionsTotalPrice);

    // Step 3: Create reservation
    const reservationData = {
      date,
      time_slot: timeSlot,
      guest_name: guestName,
      guest_count: guestCount,
      email: email || null,
      phone,
      water_temperature: waterTemperature,
      status: "pending",
      is_confirmed: false,
      total_price: totalPrice
    };

    const { data: newReservation, error: insertError } = await supabase
      .from("reservations")
      .insert(reservationData)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating reservation:", insertError);
      throw insertError;
    }

    if (!newReservation?.reservation_code || !newReservation.confirmation_token) {
      throw new Error("予約コードまたは確認トークンが生成されませんでした");
    }

    console.log("Reservation created:", newReservation.reservation_code);

    // Step 4: Save reservation options
    if (reservationOptionsData.length > 0) {
      const optionsWithReservationId = reservationOptionsData.map(opt => ({
        ...opt,
        reservation_id: newReservation.id
      }));

      const { error: optionsInsertError } = await supabase
        .from("reservation_options")
        .insert(optionsWithReservationId);

      if (optionsInsertError) {
        console.error("Error saving options:", optionsInsertError);
        // Don't fail the entire reservation if options fail
      } else {
        console.log("Options saved successfully");
      }
    }

    // Step 5: Send notification (async, don't wait)
    supabase.functions.invoke("send-pending-notification", {
      body: {
        date: reservationData.date,
        timeSlot: reservationData.time_slot,
        guestName: reservationData.guest_name,
        guestCount: reservationData.guest_count,
        email: reservationData.email,
        phone: reservationData.phone,
        waterTemperature: reservationData.water_temperature,
        reservationCode: newReservation.reservation_code,
        confirmationToken: newReservation.confirmation_token,
        reservationDate: new Date(date).toISOString(),
        total_price: totalPrice,
        options: selectedOptions
      }
    }).catch(err => console.error("Notification error:", err));

    // LINE notification to staff (fire-and-forget)
    supabase.functions.invoke("line-notify-staff", {
      body: { event: "created", reservation: newReservation }
    }).catch(err => console.error("LINE notify error:", err));

    return new Response(
      JSON.stringify({
        success: true,
        reservationCode: newReservation.reservation_code,
        confirmationToken: newReservation.confirmation_token,
        accessToken: newReservation.access_token
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "予約の作成に失敗しました" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
};

serve(handler);
