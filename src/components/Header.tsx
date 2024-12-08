import { useState } from 'react';
import { Waves, Wind } from 'lucide-react';

const Header = () => {
  const [backgroundImage] = useState<string>('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9');

  return (
    <header className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${backgroundImage}')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/90 to-sauna-charcoal/70 backdrop-blur-sm z-0" />
      
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div className="text-left space-y-6 animate-fade-up">
            <div className="space-y-2">
              <h1 className="text-8xl font-bold text-gradient">U</h1>
              <p className="text-xl text-sauna-stone/90 font-medium tracking-wide">
                福岡から車で30分
              </p>
            </div>
            <div className="glass-card p-6 space-y-4 hover-lift">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-sauna-copper" />
                <h2 className="text-lg font-medium text-sauna-copper">水温</h2>
              </div>
              <p className="text-3xl font-bold text-white">
                5℃ 〜 20℃
              </p>
              <p className="text-sm text-sauna-stone/80">
                地下深層水の掛け流し
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-card p-6 hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <Wind className="w-5 h-5 text-sauna-copper" />
                <h2 className="text-lg font-medium text-sauna-copper">三郡山の風</h2>
              </div>
              <p className="text-sauna-stone/80 leading-relaxed">
                三つの山からなる谷間を吹き抜ける
                涼やかな風が、身体を包み込む。
              </p>
            </div>
            <div className="glass-card p-6 hover-lift">
              <p className="text-lg text-sauna-stone/90 font-medium">
                五感を解き放つ、究極のサウナ体験。
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;