import React, { useEffect, useState } from 'react';

const SteamAnimation = () => {
  const [dots, setDots] = useState<{ id: number; x: number; y: number; opacity: number }[]>([]);

  useEffect(() => {
    let dotId = 0;
    const maxDots = 30;
    
    const addDot = () => {
      if (dots.length >= maxDots) return;
      
      const newDot = {
        id: dotId++,
        x: Math.random() * 100,
        y: Math.random() * 100,
        opacity: 1
      };
      
      setDots(prevDots => [...prevDots, newDot]);
      
      setTimeout(() => {
        setDots(prevDots => prevDots.filter(dot => dot.id !== newDot.id));
      }, 3000);
    };

    const interval = setInterval(addDot, 200);
    return () => clearInterval(interval);
  }, [dots]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {dots.map((dot) => (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r="1"
            fill="rgba(0, 0, 0, 0.2)"
            className="animate-fade-up"
          />
        ))}
      </svg>
    </div>
  );
};

export default SteamAnimation;