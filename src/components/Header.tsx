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
      if (/^[A-Z0-9]{8}$/.test(searchInput.trim().toUpperCase())) {
        navigate(`/reservation/${searchInput.trim().toUpperCase()}`);
        return;
      }

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
    <header className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-sauna-base">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-black hover:text-sauna-stone transition-colors text-xs"
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
              className="w-48 bg-sauna-charcoal/50 border-sauna-stone/30 text-white placeholder:text-sauna-stone/50"
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
            <img src="/logo.svg" alt="U" className="h-16 w-auto mx-auto mb-4" />
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              x="0px"
              y="0px"
              width="120"
              viewBox="0 0 768 256"
              enableBackground="new 0 0 768 256"
              className="mx-auto mb-4 h-8"
            >
              <path
                fill="#000000"
                opacity="1.000000"
                stroke="none"
                d="M200.999969,204.272278 C165.180954,204.274841 129.861954,204.283279 94.542953,204.274017 C87.708458,204.272232 87.708458,204.240311 87.676292,197.303833 C87.622353,185.670990 87.622353,185.671722 99.277527,185.671967 C157.420609,185.673218 215.563675,185.675629 273.706757,185.672989 C280.728149,185.672668 280.754578,185.659714 280.757263,178.499664 C280.769073,147.012451 280.767822,115.525230 280.762848,84.038010 C280.761780,77.341354 280.745422,77.326279 273.777893,77.325592 C225.963959,77.320877 178.150040,77.324203 130.336105,77.321609 C122.884895,77.321205 122.836845,77.313148 122.862442,69.904015 C122.907295,56.915844 121.663643,58.722622 134.018845,58.707905 C186.830658,58.644989 239.642609,58.673725 292.454498,58.676826 C299.364136,58.677235 299.387024,58.698128 299.386108,65.483162 C299.381073,103.301071 299.363556,141.118973 299.351562,178.936890 C299.349426,185.659454 299.352112,185.668961 306.264191,185.673279 C318.092712,185.680634 329.925232,185.850876 341.747742,185.584305 C346.222839,185.483383 347.512268,187.071503 347.394196,191.364548 C346.973785,206.649185 349.504944,204.200684 334.443054,204.238708 C290.128937,204.350601 245.814362,204.274475 200.999969,204.272278 z"
              />
              <path
                fill="#000000"
                opacity="1.000000"
                stroke="none"
                d="M714.302734,122.741760 C714.185913,125.386543 712.748108,125.979324 710.905334,126.036644 C709.240417,126.088440 707.573608,126.096603 705.907654,126.096458 C624.593262,126.089439 543.278870,126.080330 461.964447,126.068245 C454.787903,126.067184 454.719025,126.056564 454.780792,118.838890 C454.894714,105.522377 452.905426,106.996178 466.831055,106.990646 C546.479187,106.959007 626.127380,106.972023 705.775513,106.971153 C714.334045,106.971062 714.335815,106.974854 714.341919,115.271309 C714.343628,117.604073 714.331787,119.936852 714.302734,122.741760 z"
              />
            </svg>
            <p className="text-sm text-black font-light tracking-wide">
              福岡から車で30分、五感を刺激するサウナ
            </p>
            <p className="text-xs text-black mt-2">
              プレオープン: 2025年2月10日
            </p>
          </div>

          <div className="glass-card p-4 space-y-3 w-full max-w-2xl hover-lift">
            <div className="space-y-2">
              <h2 className="text-lg font-light text-white whitespace-normal">
                1日3組限定<br />プライベート
              </h2>
              <div className="space-y-2">
                <p className="text-xs text-sauna-stone/90 font-light whitespace-nowrap">
                  薪、地下水、山の風
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};