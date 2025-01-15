import React, { useEffect, useRef } from 'react';

export const AnimatedLogo = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const lines = svgRef.current?.querySelectorAll('.logo-line');
    lines?.forEach((line, index) => {
      line.setAttribute('style', `
        animation: drawLine 0.5s ease forwards ${index * 0.02}s;
        opacity: 0;
      `);
    });
  }, []);

  // 水平な線を生成する関数
  const generateLines = () => {
    const lines = [];
    const spacing = 4; // 線の間隔
    const width = 120; // U字の幅
    const height = 160; // U字の高さ
    const bottomHeight = 20; // 底の部分の高さ
    const lineCount = Math.floor(height / spacing); // 線の総数

    // 左側の縦線
    for (let i = 0; i < lineCount; i++) {
      const y = i * spacing;
      const lineWidth = 40;
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
        />
      );
    }

    // 右側の縦線
    for (let i = 0; i < lineCount; i++) {
      const y = i * spacing;
      const lineWidth = 40;
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
        />
      );
    }

    // 底の部分の横線
    const bottomY = height - bottomHeight;
    for (let i = 0; i < 5; i++) {
      const y = bottomY + (i * spacing);
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