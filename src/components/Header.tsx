import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from './ui/input';
import { Instagram } from 'lucide-react';
import { toast } from 'sonner';

export const Header = () => {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

  const handleReservationCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = searchInput.trim().toUpperCase();
    
    if (!code) {
      toast.error('予約コードを入力してください');
      return;
    }

    // Check if input is a reservation code (alphanumeric, 8 characters)
    if (/^[A-Z0-9]{8}$/.test(code)) {
      navigate(`/reservation/${code}`);
      setSearchInput('');
    } else {
      toast.error('予約コードは8桁の英数字で入力してください');
    }
  };
  
  return (
    <header className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-sauna-base">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <a
          href="https://www.instagram.com/u__sauna/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-black/80 hover:text-black transition-colors"
        >
          <Instagram className="h-5 w-5" />
        </a>
        <form onSubmit={handleReservationCodeSubmit} className="flex gap-2 bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm">
          <Input
            type="text"
            placeholder="予約コード（8桁）"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-48 bg-transparent border-black/30 text-black placeholder:text-black/50 font-mplus font-extralight"
            maxLength={8}
          />
        </form>
      </div>
      
      <div className="relative z-10 w-full mx-auto text-center">
        <div className="h-24" />
        <div className="flex flex-col items-center space-y-4 px-4 md:px-0 pb-8">
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
