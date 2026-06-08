import { AnalysisShell } from '@/components/upload/AnalysisShell';
import { VectorCanvas } from '@/components/ui/VectorCanvas';
import { TalentGraphHeader } from '@/components/ui/TalentGraphHeader';

export default function Home() {
  return (
    <main className="relative flex w-full max-w-[100vw] h-full min-h-screen flex-col items-center gap-8 px-4 sm:px-6 py-12 sm:py-16 overflow-hidden">
      {/* ── Vector Canvas Grid & Particles ── */}
      <VectorCanvas />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* ── Vibrant organic radial glow gradients ── */}
      <div className="pointer-events-none absolute inset-0 -z-20 flex justify-center opacity-40 mix-blend-screen">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-teal-600/30 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/30 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[20%] h-[700px] w-[700px] rounded-full bg-violet-600/30 blur-[150px]" />
        
        {/* Cosmic Fire Lighting */}
        <div className="absolute top-[40%] left-[40%] h-[400px] w-[400px] rounded-full bg-[#ff5500]/40 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] h-[450px] w-[450px] rounded-full bg-[#ef4444]/40 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-2xl my-6 relative z-10">
        <TalentGraphHeader />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        <AnalysisShell />
      </div>
    </main>
  );
}
