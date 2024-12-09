import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function ReservationPending() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = location.state?.reservationCode;

  useEffect(() => {
    // If no reservation code is provided, redirect to home
    if (!reservationCode) {
      console.log("No reservation code found, redirecting to home");
      navigate('/');
    }
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

          <div className="space-y-4 text-sauna-stone">
            <p>メールまたはSMSに送信された確認リンクから、20分以内に予約を確定してください。</p>
            <p>20分を過ぎると予約は自動的にキャンセルされます。</p>
            <p className="text-xs">※ドメインが「u-sauna-private.com」からのリンクが正しいものです。</p>
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