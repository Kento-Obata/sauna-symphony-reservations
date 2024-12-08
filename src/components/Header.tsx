import { useState } from 'react';
import { Mountain, Waves, Wind } from 'lucide-react';

const Header = () => {
  const [backgroundImage] = useState<string>('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9');

  return (
    <header className="relative h-screen flex items-center justify-center overflow-hidden">
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
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-8xl font-bold text-gradient">U</h1>
              <Mountain className="w-8 h-8 text-sauna-copper opacity-80" />
            </div>
            <p className="text-xl text-sauna-stone/90 font-medium tracking-wide">
              福岡、宇美町の秘境にて
            </p>
            <div className="glass-card p-6 space-y-4 hover-lift">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-sauna-copper" />
                <h2 className="text-lg font-medium text-sauna-copper">水温</h2>
              </div>
              <p className="text-3xl font-bold text-white">
                5℃ 〜 17℃
              </p>
              <p className="text-sm text-sauna-stone/80">
                お好みの温度をお選びください
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-card p-6 hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <Wind className="w-5 h-5 text-sauna-copper" />
                <h2 className="text-lg font-medium text-sauna-copper">三軍山のそよ風</h2>
              </div>
              <p className="text-sauna-stone/80 leading-relaxed">
                標高365メートルの三軍山から吹き降ろす
                清々しい風が、心地よさを際立たせる。
              </p>
            </div>
            <div className="glass-card p-6 hover-lift">
              <p className="text-lg text-sauna-stone/90 font-medium">
                究極のととのい体験、ここにあり。
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;