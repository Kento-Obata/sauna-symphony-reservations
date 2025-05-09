
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/utils/priceCalculations";
import { Option } from "@/types/option";

interface ReservationDetails {
  total_price: number;
  options?: {
    option: Option;
    quantity: number;
  }[];
}

// Define the structure of the option data that comes back from Supabase
interface ReservationOptionResponse {
  quantity: number;
  option_id: string;
  options: {
    id: string;
    name: string;
    description: string | null;
    price_per_person: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
}

export default function ReservationPending() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = location.state?.reservationCode;
  const [details, setDetails] = useState<ReservationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no reservation code is provided, redirect to home
    if (!reservationCode) {
      navigate('/');
      return;
    }

    // Fetch the reservation to get the total price and options
    const fetchReservation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 予約情報を取得
        const { data: reservation, error } = await supabase
          .from("reservations")
          .select("id, total_price")
          .eq("reservation_code", reservationCode)
          .single();

        if (error || !reservation) {
          console.error("予約情報取得エラー:", error);
          setError("予約情報の取得に失敗しました");
          return;
        }

        // 予約オプション情報を取得
        const { data: reservationOptions, error: optionsError } = await supabase
          .from("reservation_options")
          .select(`
            quantity,
            option_id,
            options:option_id(
              id, name, description, price_per_person, is_active, created_at, updated_at
            )
          `)
          .eq("reservation_id", reservation.id);

        if (optionsError) {
          console.error("オプション取得エラー:", optionsError);
          // オプション取得エラーの場合はオプションなしで続行
        }

        // オプション情報を整形
        const formattedOptions = reservationOptions?.map((item: any) => ({
          option: item.options as Option,
          quantity: item.quantity
        })).filter(item => item.option) || [];

        setDetails({
          total_price: reservation.total_price,
          options: formattedOptions.length > 0 ? formattedOptions : undefined
        });
      } catch (err) {
        console.error("Failed to fetch reservation:", err);
        setError("予約情報の取得中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [reservationCode, navigate]);

  if (!reservationCode) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
      <div className="glass-card p-8 max-w-2xl w-full mx-4">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-gradient">仮予約を受け付けました</h1>
          
          <div className="space-y-4">
            <p className="text-lg">予約コード</p>
            <p className="text-2xl font-bold">{reservationCode}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md">
              {error}
            </div>
          )}

          {!isLoading && details !== null && (
            <div className="space-y-2">
              <p className="text-lg">料金</p>
              <p className="text-2xl font-bold">{formatPrice(details.total_price)}</p>
              
              {details.options && details.options.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium mb-1">選択オプション:</p>
                  <ul className="space-y-1">
                    {details.options.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{item.option.name}</span>
                        <span>{formatPrice(item.option.price_per_person)} × {item.quantity}名様</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 text-sauna-stone">
            <p>メールまたはSMSに送信された確認リンクから、20分以内に予約を確定してください。</p>
            <p>20分を過ぎると予約は自動的にキャンセルされます。</p>
          </div>

          <div className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              トップページに戻る
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
