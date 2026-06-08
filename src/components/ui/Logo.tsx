
export const TalentGraphLogo = () => {
  return (
    <svg 
      className="h-8 w-8 text-neutral-50 filter drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] transition-transform duration-300 hover:scale-105" 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Architectural crisp monogram intersection of T and G */}
      <path 
        d="M15 25H85M50 25V75M50 48H78V75H38V58" 
        stroke="currentColor" 
        strokeWidth="11" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle cx="38" cy="58" r="2.5" fill="currentColor" />
    </svg>
  );
};
