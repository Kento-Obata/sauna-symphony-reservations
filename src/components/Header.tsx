import { useState } from 'react';

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
            <h1 className="text-8xl font-bold mb-6 text-gradient">U</h1>
            <p className="text-xl text-sauna-stone">
              福岡、宇美町。五感で味わう究極のサウナ
            </p>
            <div className="glass-card p-6 space-y-4 hover-lift">
              <h2 className="text-lg font-medium text-sauna-copper">水風呂温度</h2>
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
              <h2 className="text-lg font-medium text-sauna-copper mb-4">三軍山のそよ風</h2>
              <p className="text-sauna-stone/80 leading-relaxed">
                標高365メートルの三軍山から吹き降ろす清々しい風が、
                サウナ後の心地よさを一層際立たせます。
              </p>
            </div>
            <div className="glass-card p-6 hover-lift">
              <p className="text-lg text-sauna-stone/80">
                あなただけの究極のととのい体験を。
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;