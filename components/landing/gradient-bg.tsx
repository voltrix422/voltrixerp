'use client';
import { useEffect, useRef } from 'react';

export default function GradientBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const draw = () => {
      time += 0.003;
      
      // Brand teal color: #1a9f9a
      const baseHue = 178; // Teal hue
      
      // Create animated gradient - from white/light gray to dark with teal accent
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      // White to light gray gradient
      gradient.addColorStop(0, '#f8fafc');    // Very light gray/white
      gradient.addColorStop(0.3, '#f1f5f9');  // Light gray
      gradient.addColorStop(0.6, '#e2e8f0');  // Medium light gray
      gradient.addColorStop(1, '#cbd5e1');    // Gray

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle teal glow orbs (brand color #1a9f9a)
      for (let i = 0; i < 3; i++) {
        const x = canvas.width * (0.2 + i * 0.3 + Math.sin(time + i) * 0.1);
        const y = canvas.height * (0.3 + Math.cos(time * 0.5 + i * 2) * 0.2);
        const radius = 400 + Math.sin(time * 0.3 + i) * 150;

        const orbGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        orbGradient.addColorStop(0, 'rgba(26, 159, 154, 0.12)');   // Teal glow
        orbGradient.addColorStop(0.4, 'rgba(26, 159, 154, 0.04)');
        orbGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = orbGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
