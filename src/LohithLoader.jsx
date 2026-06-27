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
    <div className="liquid-loader-container">
      <style>{`
        /* Fade-in Animation */
        @keyframes fade-in {
          from { opacity: 0; transform: scale(1.03); }
          to { opacity: 1; transform: scale(1); }
        }
        
        .liquid-loader-container {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0A0908;
          overflow: hidden;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          padding: 24px;
        }

        /* Volumetric Liquid background blobs */
        .liquid-blob-1 {
          position: absolute;
          width: 320px;
          height: 320px;
          top: 20%;
          left: 15%;
          background: linear-gradient(135deg, #C5A880 0%, #8C7853 100%);
          filter: blur(80px);
          opacity: 0.18;
          animation: blob-float-1 25s ease-in-out infinite alternate, liquid-morph-1 12s ease-in-out infinite;
        }

        .liquid-blob-2 {
          position: absolute;
          width: 280px;
          height: 280px;
          bottom: 15%;
          right: 15%;
          background: linear-gradient(135deg, #6B8F71 0%, #4E6E54 100%);
          filter: blur(80px);
          opacity: 0.15;
          animation: blob-float-2 30s ease-in-out infinite alternate, liquid-morph-2 15s ease-in-out infinite;
        }

        @keyframes blob-float-1 {
          0% { transform: translate(-60px, -40px) rotate(0deg) scale(0.95); }
          50% { transform: translate(60px, 40px) rotate(180deg) scale(1.05); }
          100% { transform: translate(-60px, -40px) rotate(360deg) scale(0.95); }
        }

        @keyframes blob-float-2 {
          0% { transform: translate(80px, 60px) rotate(0deg) scale(1.05); }
          50% { transform: translate(-80px, -60px) rotate(-180deg) scale(0.95); }
          100% { transform: translate(80px, 60px) rotate(-360deg) scale(1.05); }
        }

        @keyframes liquid-morph-1 {
          0% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
          33% { border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%; }
          66% { border-radius: 50% 50% 30% 70% / 40% 60% 30% 70%; }
          100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
        }

        @keyframes liquid-morph-2 {
          0% { border-radius: 50% 50% 30% 70% / 40% 60% 30% 70%; }
          33% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
          66% { border-radius: 70% 30% 52% 48% / 60% 40% 60% 40%; }
          100% { border-radius: 50% 50% 30% 70% / 40% 60% 30% 70%; }
        }

        /* Glass Card */
        .glass-loader-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 320px;
          padding: 44px 32px;
          background: rgba(28, 25, 23, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        /* Liquid loader visual inside card */
        .liquid-loader-visual {
          position: relative;
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .liquid-inner-blob {
          position: absolute;
          inset: 0px;
          background: linear-gradient(135deg, rgba(197, 168, 128, 0.18) 0%, rgba(107, 143, 113, 0.18) 100%);
          border: 1.5px solid rgba(197, 168, 128, 0.4);
          animation: liquid-morph-1 6s ease-in-out infinite;
          box-shadow: 
            0 0 25px rgba(197, 168, 128, 0.25),
            inset 0 0 15px rgba(255, 255, 255, 0.05);
        }

        .liquid-inner-core {
          position: absolute;
          width: 24px;
          height: 24px;
          background: #C5A880;
          border-radius: 50%;
          box-shadow: 0 0 25px #C5A880;
          animation: liquid-core-pulse 2s ease-in-out infinite alternate;
        }

        @keyframes liquid-core-pulse {
          0% { transform: scale(0.85); opacity: 0.7; filter: brightness(0.9); }
          100% { transform: scale(1.15); opacity: 1; filter: brightness(1.2); }
        }

        .glass-title {
          font-size: 1.125rem;
          font-weight: 700;
          margin: 0 0 6px 0;
          background: linear-gradient(135deg, #FFFFFF 0%, #D8D6D4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 0.02em;
        }

        .glass-subtitle {
          font-size: 0.8125rem;
          color: #A8A29E;
          font-weight: 500;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
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

        /* Progress Bar wrapper */
        .glass-progress-wrapper {
          width: 100%;
          margin-top: 28px;
        }

        .glass-progress-bg {
          width: 100%;
          height: 5px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
          border: 0.5px solid rgba(255, 255, 255, 0.05);
        }

        .glass-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6B8F71 0%, #C5A880 100%);
          box-shadow: 0 0 10px rgba(197, 168, 128, 0.5);
          border-radius: 9999px;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .glass-progress-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: #C5A880;
          margin-top: 8px;
          letter-spacing: 0.02em;
        }
      `}</style>

      {/* Volumetric background morphing fluid blobs */}
      <div className="liquid-blob-1" />
      <div className="liquid-blob-2" />

      {/* Glass Loading Card */}
      <div className="glass-loader-card">
        {/* Liquid visual loader element */}
        <div className="liquid-loader-visual">
          <div className="liquid-inner-blob" />
          <div className="liquid-inner-core" />
        </div>

        {/* Content */}
        <h2 className="glass-title">Lohith AI Analysis</h2>
        <p className="glass-subtitle">
          <span>{loadingMsg}</span>
          <span className="typing-ellipsis" />
        </p>

        {/* Glass progress bar */}
        <div className="glass-progress-wrapper">
          <div className="glass-progress-bg">
            <div 
              className="glass-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="glass-progress-text">{Math.floor(progress)}%</div>
        </div>
      </div>
    </div>
  );
}
