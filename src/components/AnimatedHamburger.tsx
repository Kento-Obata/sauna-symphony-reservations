import { useState, useEffect, useCallback } from 'react';

interface Line {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

export const AnimatedHamburger = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  const [lines, setLines] = useState<Line[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const generateRandomLine = useCallback(() => {
    const size = 24; // SVGのサイズ
    const margin = 2; // 端からの余白
    
    // ランダムな始点と終点を生成
    const x1 = margin + Math.random() * (size - 2 * margin);
    const y1 = margin + Math.random() * (size - 2 * margin);
    const length = 3 + Math.random() * 8; // 線の長さを3-11pxの間でランダムに
    const angle = Math.random() * Math.PI * 2; // ランダムな角度
    
    return {
      id: Date.now() + Math.random(),
      x1,
      y1,
      x2: x1 + Math.cos(angle) * length,
      y2: y1 + Math.sin(angle) * length,
      opacity: 0.8 + Math.random() * 0.2, // 0.8-1.0の間でランダムな透明度
    };
  }, []);

  useEffect(() => {
    if (isOpen && !isAnimating) {
      setIsAnimating(true);
      const interval = setInterval(() => {
        setLines(prevLines => {
          if (prevLines.length >= 30) { // 最大30本の線
            clearInterval(interval);
            return prevLines;
          }
          return [...prevLines, generateRandomLine()];
        });
      }, 50); // 50ミリ秒ごとに新しい線を追加

      return () => clearInterval(interval);
    } else if (!isOpen) {
      setLines([]);
      setIsAnimating(false);
    }
  }, [isOpen, isAnimating, generateRandomLine]);

  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 flex items-center justify-center focus:outline-none"
      aria-label="メニュー"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="absolute transition-opacity duration-300"
        style={{ opacity: isOpen ? 0 : 1 }}
      >
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="absolute transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
      >
        {lines.map((line) => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth="1"
            opacity={line.opacity}
          />
        ))}
      </svg>
    </button>
  );
};