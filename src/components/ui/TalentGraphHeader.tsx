import React from 'react';

export const TalentGraphHeader: React.FC = () => {
  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-6 md:p-10 text-center select-none">
      
      <div className="absolute inset-0 rounded-2xl bg-white/[0.02] backdrop-blur-md border border-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" />
      
      
      <div className="relative z-10 mb-4 px-3.5 py-1 text-[10px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase rounded-full border border-cyan-500/20 bg-cyan-950/30">
        ✦ AI POWERED
      </div>

      
      <h1 className="relative z-10 font-orbitron font-black text-3xl sm:text-4xl md:text-5xl tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        TalentGraph – AI
      </h1>

      
      <div className="relative z-10 flex items-center justify-center mt-3.5 w-full">
        <h2 className="font-rajdhani font-bold text-sm sm:text-base tracking-[0.45em] text-neutral-300 uppercase">
          RESUME <span className="text-cyan-400 mx-1.5">•</span> ANALYZER
        </h2>
      </div>
    </div>
  );
};
