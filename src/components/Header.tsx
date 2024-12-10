import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Menu } from 'lucide-react';
import { toast } from 'sonner';

export const Header = () => {
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
    <header className="relative h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 transition-opacity duration-1000">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed transform scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80')`,
            willChange: 'transform',
          }}
        />
      </div>
      
      <div 
        className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/95 via-sauna-charcoal/90 to-sauna-charcoal japanese-pattern"
        style={{
          willChange: 'opacity',
        }}
      />
      
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <a href="/" className="text-white/90 hover:text-white transition-colors">
            <span className="sr-only">Home</span>
            <Menu className="h-6 w-6" />
          </a>
          
          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-white/80 hover:text-sauna-copper transition-colors text-sm tracking-wide"
            >
              予約確認
            </button>
            {showForm && (
              <form onSubmit={handleReservationLookup} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="予約コード"
                  value={reservationCode}
                  onChange={(e) => setReservationCode(e.target.value)}
                  className="w-40 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-sauna-copper/50"
                />
                <Button type="submit" variant="secondary" size="icon" className="bg-white/5 hover:bg-white/10 border-white/10">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </nav>
      
      <div className="relative z-10 w-full mx-auto text-center">
        <div className="flex flex-col items-center space-y-8 px-4 md:px-0 animate-fade-in">
          {/* Brand and Location */}
          <div className="space-y-3">
            <h1 className="text-6xl font-extralight text-gradient tracking-wider">
              Sauna U
            </h1>
            <p className="text-sm text-white/60 font-light tracking-[0.2em] uppercase">
              福岡から車で30分
            </p>
          </div>

          {/* Main Features */}
          <div className="glass-card p-8 space-y-6 w-full max-w-xl mx-auto hover-lift">
            <div className="space-y-4">
              <h2 className="text-2xl font-light text-white">
                1日3組限定
                <span className="block mt-1 text-lg text-white/90">
                  プライベートサウナ
                </span>
              </h2>
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-sauna-copper/30 to-transparent mx-auto my-6" />
              <div className="space-y-3">
                <p className="text-sm text-white/60 font-light tracking-wide">
                  予約前に最低5℃の水温を選ぶだけ
                </p>
                <p className="text-sm text-white/60 font-light tracking-wide">
                  詳細非公開<br />五感を刺激する究極のサウナ体験
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-px h-16 bg-gradient-to-b from-sauna-copper/0 via-sauna-copper/30 to-sauna-copper/0" />
      </div>
    </header>
  );
};