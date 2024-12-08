import { useState } from 'react';

export const Header = () => {
  const [backgroundImage] = useState<string>('https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80');

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
      
      <div className="relative z-10 w-full mx-auto text-center pt-8">
        <div className="flex flex-col items-center space-y-6 px-4 md:px-0">
          {/* Brand and Location */}
          <div className="space-y-2">
            <h1 className="text-4xl font-light text-gradient">Sauna U</h1>
            <p className="text-sm text-sauna-stone/90 font-light tracking-wide">
              福岡から車で30分
            </p>
          </div>

          {/* Main Features */}
          <div className="glass-card p-6 space-y-5 w-full max-w-2xl hover-lift">
            <div className="space-y-4">
              <h2 className="text-lg font-light text-white">
                1日3組限定、
                <br />
                完全貸切プライベートサウナ
              </h2>
              <div className="space-y-3">
                <p className="text-xs text-sauna-stone/90 font-light">
                  予約前に最低5℃まで
                  <br />
                  水温を選ぶだけ
                </p>
                <p className="text-xs text-sauna-stone/90 font-light">
                  詳細非公開、
                  <br />
                  五感を刺激する究極のサウナ体験を
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};