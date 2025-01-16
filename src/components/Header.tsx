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
    <header className="relative h-[60vh] flex flex-col items-center justify-center overflow-hidden bg-sauna-base">
      {/* Navigation Bar */}
      <div className="w-full h-16 flex items-center justify-between px-6 fixed top-0 left-0 z-50 bg-sauna-base/50 backdrop-blur-sm border-b border-black/10">
        <div className="text-black/80 text-sm font-mplus font-extralight">
          U
        </div>
        <div className="flex items-center gap-8">
          <a href="#reservation-section" className="text-black/80 hover:text-black transition-colors text-xs font-mplus font-extralight">
            予約
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-black/80 hover:text-black transition-colors text-xs font-mplus font-extralight"
          >
            予約確認
          </button>
        </div>
      </div>

      {/* Search Form */}
      <div className="absolute top-20 right-4 z-20">
        {showForm && (
          <form onSubmit={handleReservationLookup} className="flex gap-2">
            <Input
              type="text"
              placeholder="予約コード or 電話番号"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-48 bg-sauna-base/50 border-black/30 text-black placeholder:text-black/50 font-mplus font-extralight"
            />
            <Button type="submit" variant="secondary" size="icon" disabled={isLoading}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 w-full mx-auto text-center mt-50">
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0">
          <div className="space-y-1">
            <img 
              src="/lovable-uploads/1aa72bce-66cd-4327-8168-efd559ff3e6e.png" 
              alt="U" 
              className="w-full md:w-[500px] h-auto mx-auto"
            />
          </div>
        </div>
      </div>
    </header>
  );
};