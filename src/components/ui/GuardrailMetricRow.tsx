import React, { useState, useEffect, useRef } from 'react';

interface GuardrailRowProps {
  label: string;
  score: number;
  type: 'green' | 'pink' | 'cyan';
  infoText: string;
}

export const GuardrailMetricRow: React.FC<GuardrailRowProps> = ({ label, score, type, infoText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const theme = {
    green: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]' },
    pink: { text: 'text-pink-400', bg: 'bg-pink-500', border: 'border-pink-500/30', glow: 'shadow-[0_0_12px_rgba(244,63,94,0.25)]' },
    cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-500/30', glow: 'shadow-[0_0_12px_rgba(34,211,238,0.25)]' }
  }[type];

  // Auto-close overlay when clicking anywhere outside to ensure flawless mobile UX navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="w-full space-y-2 text-left select-none">
      <div className="flex items-center justify-between relative">
        <div className="flex items-center space-x-2">
          <span className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wide">{label}</span>
          
          
          <div 
            ref={triggerRef}
            className="relative inline-block cursor-pointer p-1"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg className={`w-4 h-4 transition-opacity ${theme.text} opacity-60 hover:opacity-100`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            
            {isOpen && (
              <div 
                ref={tooltipRef}
                className={`
                  /* 1. Mobile Default Framework Structure (iPhone 5 up to Small Tabs) */
                  fixed bottom-4 left-4 right-4 mx-auto w-auto max-w-[calc(100vw-2rem)] p-4 rounded-xl z-[999]
                  
                  /* 2. Desktop & Tablet Adaptive Core Anchoring Grid (Prevents Clipping) */
                  sm:absolute sm:bottom-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mb-2 sm:w-64 sm:mx-0
                  
                  /* 3. Global Premium Interface Visual Theme Styling Elements */
                  border bg-neutral-950/98 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] 
                  text-[11px] sm:text-xs leading-relaxed text-neutral-300 font-normal ${theme.border}
                  animate-in fade-in zoom-in-95 duration-200
                `}
              >
                
                <div className={`hidden sm:block absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] transition-colors border-t-neutral-950`} />
                
                <div className={`font-bold mb-1.5 uppercase tracking-widest text-[10px] ${theme.text}`}>
                  System Parameter Specs
                </div>
                {infoText}
              </div>
            )}
          </div>
        </div>
        <span className={`text-xs sm:text-sm font-bold font-mono ${theme.text}`}>{score}%</span>
      </div>

      
      <div className="w-full h-1.5 bg-neutral-950 rounded-full border border-white/[0.02] overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${theme.bg} ${theme.glow}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};
