import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function ReservationComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationCode = location.state?.reservationCode;

  useEffect(() => {
    // If no reservation code is provided, redirect to home
    if (!reservationCode) {
      navigate('/');
    }
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

          <div className="space-y-4 text-sauna-stone">
            <p>予約内容の確認メールをお送りしました。</p>
            <p>当日は予約コードをご提示ください。</p>
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