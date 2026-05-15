// src/mmss/magnetic/FieldCanvas.jsx — визуализация магнитного поля
import React, { useRef, useEffect } from 'react';

export function FieldCanvas({ metrics, phase }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!metrics || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const draw = () => {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);
      
      // Центральная частица
      const cx = W/2 + metrics.res_x * 40;
      const cy = H/2 + metrics.res_y * 40;
      const r = 14 + Math.abs(metrics.charge) * 18;
      
      // Ядро
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const hue = 210 + metrics.charge * 120;
      const light = 40 + metrics.stability * 30;
      ctx.fillStyle = `hsla(${hue}, 80%, ${light}%, 0.85)`;
      ctx.fill();
      
      // Кольца волны
      const rings = Math.floor(metrics.wavelength * 5) + 2;
      for (let i = 1; i <= rings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + i * 11, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue + i * 20 + t * 8}, 75%, 55%, ${0.15 + metrics.stability * 0.2})`;
        ctx.lineWidth = 1 + metrics.spin * 1.2;
        ctx.stroke();
      }
      
      // Шум при нестабильности
      if (metrics.stability < 0.4) {
        for (let i = 0; i < 25; i++) {
          ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
          ctx.fillRect(
            cx + (Math.random() - 0.5) * 90,
            cy + (Math.random() - 0.5) * 90,
            2, 2
          );
        }
      }
      
      t += metrics.spin * 0.015;
      animRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [metrics, phase]);

  return (
    <canvas 
      ref={canvasRef} 
      width={520} 
      height={300}
      style={{ 
        background: '#0a0a12', 
        border: '1px solid #2a2a3a', 
        borderRadius: '10px',
        display: 'block',
        margin: '0 auto'
      }} 
    />
  );
}
