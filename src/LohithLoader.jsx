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
    <div className="lohith-loader-overlay">
      <style>{`
        /* Fade-in Animation */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .lohith-loader-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: radial-gradient(circle at center, #1C1917 0%, #0E0E0E 100%);
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          animation: fade-in 0.4s ease-out forwards;
        }

        /* 3D Gyroscope Viewport */
        .viewport-3d {
          perspective: 1000px;
          width: 220px;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 32px;
        }

        .stage-3d {
          width: 200px;
          height: 200px;
          position: relative;
          transform-style: preserve-3d;
          animation: stage-breathe 4s ease-in-out infinite alternate;
        }

        /* Breathing Effect */
        @keyframes stage-breathe {
          0% { transform: scale(0.98) rotateX(0deg); }
          100% { transform: scale(1.04) rotateX(10deg); }
        }

        /* 3D Rings */
        .ring-3d {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(212, 175, 55, 0.4);
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(8px);
          box-shadow: 
            0 0 20px rgba(212, 175, 55, 0.1),
            inset 0 0 20px rgba(212, 175, 55, 0.05);
          transform-style: preserve-3d;
        }

        .ring-1 {
          transform: rotateX(70deg) rotateY(0deg);
          animation: ring-rot-1 12s linear infinite;
        }

        .ring-2 {
          transform: rotateX(70deg) rotateY(120deg);
          animation: ring-rot-2 15s linear infinite;
        }

        .ring-3 {
          transform: rotateX(70deg) rotateY(240deg);
          animation: ring-rot-3 18s linear infinite;
        }

        @keyframes ring-rot-1 {
          0% { transform: rotateX(70deg) rotateY(0deg) rotateZ(0deg); }
          100% { transform: rotateX(70deg) rotateY(0deg) rotateZ(360deg); }
        }

        @keyframes ring-rot-2 {
          0% { transform: rotateX(50deg) rotateY(120deg) rotateZ(360deg); }
          100% { transform: rotateX(50deg) rotateY(120deg) rotateZ(0deg); }
        }

        @keyframes ring-rot-3 {
          0% { transform: rotateX(60deg) rotateY(240deg) rotateZ(0deg); }
          100% { transform: rotateX(60deg) rotateY(240deg) rotateZ(360deg); }
        }

        /* Core Orb Glow */
        .orb-core-3d {
          position: absolute;
          width: 80px;
          height: 80px;
          top: 60px;
          left: 60px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #D4AF37 0%, #1B4D3E 60%, #121212 100%);
          box-shadow: 
            0 0 50px rgba(212, 175, 55, 0.35),
            inset -6px -6px 20px rgba(0, 0, 0, 0.8),
            inset 6px 6px 20px rgba(255, 255, 255, 0.15);
          animation: pulse-core 3s ease-in-out infinite alternate;
        }

        @keyframes pulse-core {
          0% { transform: scale(0.95); opacity: 0.9; filter: brightness(0.9) blur(0.5px); }
          100% { transform: scale(1.05); opacity: 1; filter: brightness(1.1) blur(1.5px); }
        }

        /* Text Elements */
        .lohith-text-group {
          text-align: center;
          margin-top: 16px;
        }

        .lohith-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #E7E5E4;
          letter-spacing: 0.05em;
          margin: 0 0 8px 0;
        }

        .lohith-subtitle {
          font-size: 0.8125rem;
          color: #A8A29E;
          font-weight: 500;
          margin: 0;
          display: inline-flex;
          align-items: center;
        }

        /* Typing Ellipsis Animation */
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

        /* Progress Bar */
        .lohith-progress-container {
          width: 240px;
          height: 2px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 9999px;
          margin-top: 24px;
          overflow: hidden;
          position: relative;
        }

        .lohith-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0.5) 0%, #D4AF37 100%);
          border-radius: 9999px;
          transition: width 0.3s ease-out;
        }
      `}</style>

      {/* Volumetric 3D Gyroscope Viewport */}
      <div className="viewport-3d">
        <div className="stage-3d">
          {/* Glowing central 3D core */}
          <div className="orb-core-3d" />
          
          {/* Gyroscopic rings rotating on X, Y, Z axes */}
          <div className="ring-3d ring-1" />
          <div className="ring-3d ring-2" />
          <div className="ring-3d ring-3" />
        </div>
      </div>

      {/* Text Elements */}
      <div className="lohith-text-group">
        <h2 className="lohith-title">Lohith AI Analysis</h2>
        <p className="lohith-subtitle">
          <span>{loadingMsg}</span>
          <span className="typing-ellipsis" />
        </p>
      </div>

      {/* Progress Bar */}
      <div className="lohith-progress-container">
        <div 
          className="lohith-progress-bar" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
