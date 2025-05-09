
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Option } from "@/types/option";
import { formatPrice } from "@/utils/priceCalculations";

interface ReservationDetails {
  total_price: number;
  options?: {
    option: Option;
    quantity: number;
  }[];
}

export default function ReservationComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = location.state?.reservationCode;
  const [details, setDetails] = useState<ReservationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reservationCode) {
      navigate('/');
      return;
    }

    // 予約詳細とオプション情報を取得
    const fetchReservationDetails = async () => {
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
            options(
              id, name, description, price_per_person, is_active, created_at, updated_at
            )
          `)
          .eq("reservation_id", reservation.id);

        if (optionsError) {
          console.error("オプション取得エラー:", optionsError);
          // オプション取得エラーの場合はオプションなしで続行
        }

        // オプション情報を整形
        const formattedOptions = reservationOptions?.map(item => ({
          option: item.options as Option,
          quantity: item.quantity
        })).filter(item => item.option) || [];

        setDetails({
          total_price: reservation.total_price,
          options: formattedOptions.length > 0 ? formattedOptions : undefined
        });
      } catch (err) {
        console.error("詳細情報取得エラー:", err);
        setError("予約情報の取得中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservationDetails();
  }, [reservationCode, navigate]);

  if (!reservationCode) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sauna-wood to-sauna-stone/10">
      <div className="glass-card p-8 max-w-2xl w-full mx-4">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-gradient">ご予約ありがとうございます</h1>
          
          <div className="space-y-4">
            <p className="text-lg">予約コード</p>
            <p className="text-2xl font-bold">{reservationCode}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-md">
              {error}
            </div>
          )}

          {!isLoading && details && (
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
            <p>予約内容の確認メールをお送りしました。</p>
            <p>当日は予約コードをご提示ください。</p>
            <p className="font-medium">受付開始時間は、ご予約時間の10分前からとなります。</p>
          </div>

          <div className="space-y-4 pt-6">
            <Button 
              onClick={() => navigate(`/reservation/${reservationCode}`)}
              className="w-full sm:w-auto"
            >
              予約詳細を確認
            </Button>
            
            <div>
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
    </div>
  );
}
