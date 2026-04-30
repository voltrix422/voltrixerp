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
      
      // Create animated gradient
      const gradient = ctx.createRadialGradient(
        canvas.width * (0.3 + Math.sin(time) * 0.2),
        canvas.height * (0.3 + Math.cos(time * 0.7) * 0.2),
        0,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.8
      );

      // Dark teal to darker teal gradient
      gradient.addColorStop(0, `hsl(${baseHue}, 60%, 25%)`);
      gradient.addColorStop(0.5, `hsl(${baseHue}, 50%, 15%)`);
      gradient.addColorStop(1, `hsl(${baseHue}, 40%, 8%)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle animated orbs
      for (let i = 0; i < 3; i++) {
        const x = canvas.width * (0.2 + i * 0.3 + Math.sin(time + i) * 0.1);
        const y = canvas.height * (0.3 + Math.cos(time * 0.5 + i * 2) * 0.2);
        const radius = 200 + Math.sin(time * 0.3 + i) * 50;

        const orbGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        orbGradient.addColorStop(0, `hsla(${baseHue}, 70%, 40%, 0.3)`);
        orbGradient.addColorStop(0.5, `hsla(${baseHue}, 60%, 30%, 0.1)`);
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
