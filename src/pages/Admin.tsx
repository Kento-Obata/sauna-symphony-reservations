import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useReservations } from "@/hooks/useReservations";
import { ReservationCalendar } from "@/components/reservation/ReservationCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Admin = () => {
  const session = useSession();
  const navigate = useNavigate();
  const { data: reservations } = useReservations();

  useEffect(() => {
    if (!session) {
      navigate("/login");
    }
  }, [session, navigate]);

  const getUpcomingReservation = () => {
    if (!reservations) return null;
    const now = new Date();
    return reservations.find(r => {
      const reservationDate = new Date(r.date);
      return reservationDate >= now;
    });
  };

  const upcomingReservation = getUpcomingReservation();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">管理画面</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>予約カレンダー</CardTitle>
            </CardHeader>
            <CardContent>
              <ReservationCalendar
                date={undefined}
                setDate={() => {}}
                reservations={reservations}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>次回の予約</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingReservation ? (
                <div className="space-y-4">
                  <p>
                    <span className="font-semibold">日時：</span>
                    {format(new Date(upcomingReservation.date), 'yyyy年MM月dd日', { locale: ja })}
                    {' '}
                    {upcomingReservation.time_slot === 'morning' ? '午前' :
                     upcomingReservation.time_slot === 'afternoon' ? '午後' : '夜'}
                  </p>
                  <p>
                    <span className="font-semibold">お客様：</span>
                    {upcomingReservation.guest_name}
                  </p>
                  <p>
                    <span className="font-semibold">人数：</span>
                    {upcomingReservation.guest_count}名
                  </p>
                  <p>
                    <span className="font-semibold">設定水温：</span>
                    {upcomingReservation.water_temperature}°C
                  </p>
                </div>
              ) : (
                <p>予約はありません</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;