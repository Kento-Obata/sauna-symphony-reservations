import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

export const Header = () => {
  const [backgroundImage] = useState<string>('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80');
  const [reservationCode, setReservationCode] = useState('');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const handleReservationLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationCode.trim()) {
      toast.error('予約コードを入力してください');
      return;
    }
    navigate(`/reservation/${reservationCode.trim().toUpperCase()}`);
  };

  return (
    <header className="relative h-[60vh] flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${backgroundImage}')`,
          willChange: 'transform',
        }}
      />
      <div 
        className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/90 to-sauna-charcoal/70 backdrop-blur-sm z-0"
        style={{
          willChange: 'opacity',
        }}
      />
      
      {/* Reservation Link and Form */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-white hover:text-sauna-copper transition-colors text-sm"
        >
          予約確認
        </button>
        {showForm && (
          <form onSubmit={handleReservationLookup} className="flex gap-2">
            <Input
              type="text"
              placeholder="予約コードを入力"
              value={reservationCode}
              onChange={(e) => setReservationCode(e.target.value)}
              className="w-40 bg-sauna-charcoal/50 border-sauna-stone/30 text-white placeholder:text-sauna-stone/50"
            />
            <Button type="submit" variant="secondary" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      
      <div className="relative z-10 w-full mx-auto text-center pt-8">
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0">
          {/* Brand and Location */}
          <div className="space-y-1">
            <h1 className="text-4xl font-light text-gradient">Sauna U</h1>
            <p className="text-sm text-sauna-stone/90 font-light tracking-wide">
              福岡から車で30分
            </p>
          </div>

          {/* Main Features */}
          <div className="glass-card p-4 space-y-3 w-full max-w-2xl hover-lift">
            <div className="space-y-2">
              <h2 className="text-lg font-light text-white whitespace-normal">
                1日3組限定<br />プライベートサウナ
              </h2>
              <div className="space-y-2">
                <p className="text-xs text-sauna-stone/90 font-light whitespace-nowrap">
                  予約前に最低5℃の水温を選ぶだけ
                </p>
                <p className="text-xs text-sauna-stone/90 font-light whitespace-nowrap">
                  詳細非公開<br />五感を刺激する究極のサウナ体験
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};