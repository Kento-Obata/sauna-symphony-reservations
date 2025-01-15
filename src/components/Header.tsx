import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
      <div 
        className="absolute inset-0 transition-opacity duration-1000"
      >
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
          className="text-white/60 hover:text-sauna-copper transition-colors text-xs font-mplus font-thin"
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
              className="w-48 bg-sauna-charcoal/50 border-sauna-stone/30 text-white placeholder:text-sauna-stone/50 font-mplus font-thin"
            />
            <Button type="submit" variant="secondary" size="icon" disabled={isLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      
      <div className="relative z-10 w-full mx-auto text-center pt-8">
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0">
          <div className="space-y-1">
            <img 
              src="/lovable-uploads/894a74ce-8ce3-4d60-b0fb-1f4e1794ab78.png" 
              alt="U" 
              className="h-24 w-auto mx-auto"
            />
            <h2 className="text-sm font-mplus font-thin tracking-widest text-[#D38248] mt-1">ユー</h2>
            <p className="text-xs text-sauna-stone/70 mt-2 font-mplus font-thin">
              pre-opening<br />
              2025.02.20
            </p>
          </div>

          <div className="glass-card p-4 space-y-3 w-full max-w-2xl hover-lift">
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="text-lg font-mplus font-thin tracking-[0.2em] text-white">
                  1日3組限定
                </div>
                <div className="text-sm font-mplus font-thin tracking-[0.15em] text-white/80">
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