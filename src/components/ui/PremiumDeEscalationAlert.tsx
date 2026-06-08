import React from 'react';

interface DeEscalationAlertProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export const PremiumDeEscalationAlert: React.FC<DeEscalationAlertProps> = ({ onRetry, isRetrying }) => {
  return (
    <div className="w-full max-w-2xl mx-auto mt-8 p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-neutral-950/80 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-center select-none animate-in fade-in zoom-in-95 duration-300">
      
      
      <div className="flex justify-center mb-4">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-full border border-amber-500/30 bg-amber-500/10">
          <svg className={`w-6 h-6 text-amber-400 ${isRetrying ? 'animate-spin' : 'animate-pulse'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isRetrying ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            )}
          </svg>
          <span className="absolute inset-0 rounded-full bg-amber-500/5 animate-ping" />
        </div>
      </div>

      
      <h3 className="font-orbitron font-bold text-sm tracking-widest text-amber-400 uppercase mb-2">
        SYSTEM WORKLOAD OPTIMIZATION ACTIVE
      </h3>
      
      <p className="font-sans text-xs sm:text-sm leading-relaxed text-neutral-300 max-w-lg mx-auto font-medium">
        We are processing high-volume candidate matrices right now. Your deep-scan analysis has been prioritized-please hold on for a moment or click re-verify.
      </p>

      
      <div className="mt-6 flex justify-center">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="relative px-6 py-2.5 font-rajdhani font-bold text-xs sm:text-sm tracking-widest uppercase rounded-xl overflow-hidden group/btn border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:text-white transition-all duration-300 hover:border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="relative z-10 flex items-center space-x-2">
            <span>{isRetrying ? 'ANALYSING MATRIX...' : 'RE-VERIFY TOKEN'}</span>
          </span>
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-full group-hover/btn:animate-shimmer" />
        </button>
      </div>
    </div>
  );
};
