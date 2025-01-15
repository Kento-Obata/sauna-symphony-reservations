import React, { useEffect, useRef } from 'react';

export const AnimatedLogo = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const lines = svgRef.current?.querySelectorAll('.logo-line');
    lines?.forEach((line, index) => {
      const rotation = (Math.random() - 0.5) * 10; // -5度から+5度のランダムな角度
      line.setAttribute('style', `
        --rotation: ${rotation}deg;
        animation: drawLine 0.5s ease forwards ${index * 0.1}s;
        opacity: 0;
      `);
    });
  }, []);

  const generateLines = () => {
    const lines = [];
    const spacing = 4; // 線の間隔
    const width = 120; // U字の幅
    const height = 160; // U字の高さ
    const bottomHeight = 20; // 底の部分の高さ
    
    // 時間とともに増える線の数を計算
    const initialLineCount = 10; // 初期の線の数
    const finalLineCount = Math.floor(height / spacing); // 最終的な線の数
    const lineCount = finalLineCount;

    // 左側の縦線
    for (let i = 0; i < lineCount; i++) {
      const y = i * spacing;
      const lineWidth = 40;
      const delay = i < initialLineCount ? i * 0.1 : (i - initialLineCount) * 0.05 + initialLineCount * 0.1;
      
      if (Math.random() > 0.2 || i < initialLineCount) { // 80%の確率で線を描画（初期の線は必ず描画）
        lines.push(
          <line
            key={`left-${i}`}
            className="logo-line"
            x1="0"
            y1={y}
            x2={lineWidth}
            y2={y}
            stroke="#D38248"
            strokeWidth="1"
            style={{
              animationDelay: `${delay}s`,
            }}
          />
        );
      }
    }

    // 右側の縦線
    for (let i = 0; i < lineCount; i++) {
      const y = i * spacing;
      const lineWidth = 40;
      const delay = i < initialLineCount ? i * 0.1 : (i - initialLineCount) * 0.05 + initialLineCount * 0.1;
      
      if (Math.random() > 0.2 || i < initialLineCount) { // 80%の確率で線を描画（初期の線は必ず描画）
        lines.push(
          <line
            key={`right-${i}`}
            className="logo-line"
            x1={width - lineWidth}
            y1={y}
            x2={width}
            y2={y}
            stroke="#D38248"
            strokeWidth="1"
            style={{
              animationDelay: `${delay}s`,
            }}
          />
        );
      }
    }

    // 底の部分の横線
    const bottomY = height - bottomHeight;
    for (let i = 0; i < 5; i++) {
      const y = bottomY + (i * spacing);
      const delay = (lineCount + i) * 0.1; // 最後に底の線を描画
      
      lines.push(
        <line
          key={`bottom-${i}`}
          className="logo-line"
          x1="0"
          y1={y}
          x2={width}
          y2={y}
          stroke="#D38248"
          strokeWidth="1"
          style={{
            animationDelay: `${delay}s`,
          }}
        />
      );
    }

    return lines;
  };

  return (
    <div className="relative w-[120px] h-[160px] mx-auto">
      <svg
        ref={svgRef}
        width="120"
        height="160"
        viewBox="0 0 120 160"
        className="absolute inset-0"
      >
        {generateLines()}
      </svg>
    </div>
  );
};