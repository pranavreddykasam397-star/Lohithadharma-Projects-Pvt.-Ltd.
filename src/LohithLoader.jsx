import React, { useEffect, useState } from 'react';

export default function LohithLoader({ isLoading, loadingMsg = "Processing..." }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    // Simulate progress bar filling slowly from 0 to 98%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return prev;
        const increment = Math.max(0.5, (100 - prev) * 0.05);
        return prev + increment;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#121212] bg-[radial-gradient(circle_at_center,_#1C1917_0%,_#121212_100%)] animate-fade-in">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .animate-breathe {
          animation: breathe 5s ease-in-out infinite;
        }

        @keyframes rotateFluid {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .animate-rotate-fluid {
          animation: rotateFluid 12s linear infinite;
        }

        @keyframes rotateFluidReverse {
          0% { transform: rotate(360deg) scale(1.1); }
          50% { transform: rotate(180deg) scale(1); }
          100% { transform: rotate(0deg) scale(1.1); }
        }
        .animate-rotate-fluid-reverse {
          animation: rotateFluidReverse 18s linear infinite;
        }

        .glass-sphere {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(197, 168, 128, 0.2);
          box-shadow: 
            0 0 60px 10px rgba(197, 168, 128, 0.12),
            inset 0 0 30px rgba(255, 255, 255, 0.03),
            inset 0 0 20px 2px rgba(197, 168, 128, 0.15);
        }

        @keyframes ellipsis {
          0% { content: '.'; }
          33% { content: '..'; }
          66% { content: '...'; }
        }
        .typing-ellipsis::after {
          content: '.';
          animation: ellipsis 1.5s steps(3, start) infinite;
          display: inline-block;
          width: 12px;
          text-align: left;
        }
      `}</style>

      {/* Centered Glassmorphism Sphere */}
      <div className="relative w-48 h-48 flex items-center justify-center animate-breathe mb-8">
        
        {/* Glow behind the sphere */}
        <div className="absolute w-40 h-40 rounded-full bg-[#C5A880]/10 blur-[40px]" />

        {/* Fluid layer 1 (outer slow rotate) */}
        <div className="absolute w-36 h-36 rounded-full bg-[radial-gradient(circle_at_30%_30%,_rgba(197,_168,_128,_0.25)_0%,_transparent_70%)] animate-rotate-fluid" />

        {/* Fluid layer 2 (inner reverse rotate) */}
        <div className="absolute w-32 h-32 rounded-full bg-[radial-gradient(circle_at_70%_70%,_rgba(197,_168,_128,_0.2)_0%,_transparent_65%)] animate-rotate-fluid-reverse" />

        {/* Glassmorphism Sphere Outer shell */}
        <div className="absolute inset-0 rounded-full glass-sphere flex items-center justify-center">
          {/* Subtle center ring highlight */}
          <div className="w-[90%] h-[90%] rounded-full border border-white/5 bg-transparent" />
        </div>

        {/* Interactive core glow */}
        <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-[#C5A880]/30 to-[#E8E0D8]/10 blur-[8px] animate-pulse" />
      </div>

      {/* UI Elements */}
      <div className="text-center space-y-2 z-10 max-w-sm w-full">
        <h2 className="text-[#E7E5E4] font-medium tracking-wide text-lg font-sans">
          Lohith AI Analysis
        </h2>
        <p className="text-xs text-[#A8A29E] font-medium h-4 flex items-center justify-center">
          <span>{loadingMsg}</span>
          <span className="typing-ellipsis" />
        </p>
      </div>

      {/* Minimalist Progress Bar */}
      <div className="w-64 h-[2px] bg-white/5 rounded-full mt-6 overflow-hidden relative">
        <div 
          className="h-full bg-gradient-to-r from-[#C5A880]/40 to-[#C5A880] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
