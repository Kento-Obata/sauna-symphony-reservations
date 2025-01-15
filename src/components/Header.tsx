import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BackgroundLines = () => {
  const [lines, setLines] = useState<Array<{
    id: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    const generateLine = (index: number) => {
      const angle = Math.random() * Math.PI * 2;
      const length = 50 + Math.random() * 150;
      const x1 = Math.random() * window.innerWidth;
      const y1 = Math.random() * window.innerHeight;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;
      
      return {
        id: index,
        x1,
        y1,
        x2,
        y2,
        delay: index * 100
      };
    };

    const totalLines = 50;
    const initialLines = Array.from({ length: totalLines }, (_, i) => generateLine(i));
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= totalLines) {
        clearInterval(interval);
        return;
      }
      
      setLines(prev => [...prev, initialLines[currentIndex]]);
      currentIndex++;
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {lines.map(line => (
        <line
          key={line.id}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(211, 130, 72, 0.1)"
          strokeWidth="1"
          className="animate-fade-in"
          style={{
            animationDelay: `${line.delay}ms`,
          }}
        />
      ))}
    </svg>
  );
};

export const Header = () => {
  const [searchInput, setSearchInput] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleReservationLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      toast.error('予約コードまたは電話番号を入力してください');
      return;
    }

    setIsLoading(true);
    try {
      // Check if input is a reservation code (alphanumeric, 8 characters)
      if (/^[A-Z0-9]{8}$/.test(searchInput.trim().toUpperCase())) {
        navigate(`/reservation/${searchInput.trim().toUpperCase()}`);
        return;
      }

      // If not a reservation code, treat as phone number
      const { error } = await supabase.functions.invoke('lookup-reservation', {
        body: { phone: searchInput.trim() },
      });

      if (error) {
        console.error('Lookup error:', error);
        toast.error('予約の検索に失敗しました');
        return;
      }

      toast.success('予約詳細のリンクをSMSで送信しました');
      setSearchInput('');
      setShowForm(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error('予約の検索に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header className="relative h-[60vh] flex items-center justify-center overflow-hidden">
      <BackgroundLines />
      
      <div className="absolute inset-0 transition-opacity duration-1000">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80')`,
            willChange: 'transform',
          }}
        />
      </div>
      
      <div 
        className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/90 to-sauna-charcoal/70 backdrop-blur-sm z-0"
        style={{
          willChange: 'opacity',
        }}
      />
      
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-white/60 hover:text-sauna-copper transition-colors text-xs font-mplus font-extralight"
        >
          予約確認
        </button>
        {showForm && (
          <form onSubmit={handleReservationLookup} className="flex gap-2">
            <Input
              type="text"
              placeholder="予約コード or 電話番号"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-48 bg-sauna-charcoal/50 border-sauna-stone/30 text-white placeholder:text-sauna-stone/50 font-mplus font-extralight"
            />
            <Button type="submit" variant="secondary" size="icon" disabled={isLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      
      <div className="relative z-10 w-full mx-auto text-center pt-8">
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0">
          <div className="space-y-1 relative group">
            {/* Decorative SVG circles */}
            <svg
              className="absolute -inset-4 opacity-70 group-hover:opacity-100 transition-opacity duration-500"
              width="200"
              height="200"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="#D38248"
                strokeWidth="0.5"
                className="animate-[spin_10s_linear_infinite]"
              />
              <circle
                cx="100"
                cy="100"
                r="60"
                stroke="#D38248"
                strokeWidth="0.5"
                strokeDasharray="4 4"
                className="animate-[spin_15s_linear_infinite_reverse]"
              />
            </svg>
            
            <div className="relative transform transition-transform duration-500 group-hover:scale-105">
              <img 
                src="/lovable-uploads/894a74ce-8ce3-4d60-b0fb-1f4e1794ab78.png" 
                alt="U" 
                className="h-24 w-auto mx-auto animate-fade-in"
              />
              <h2 className="text-base md:text-lg font-mplus font-extralight tracking-widest text-[#D38248] mt-1 animate-fade-up">
                ユー
              </h2>
              <p className="text-xs text-white/90 mt-2 font-mplus font-extralight animate-fade-up" style={{ animationDelay: '200ms' }}>
                pre-opening<br />
                2025.02.20
              </p>
            </div>
          </div>

          <div className="glass-card p-4 space-y-3 w-full max-w-2xl hover-lift">
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-lg font-mplus font-extralight tracking-[0.2em] text-white">
                  1日3組限定
                </div>
                <div className="text-sm font-mplus font-extralight tracking-[0.15em] text-white/80">
                  詳細非公開体験型サウナ
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};