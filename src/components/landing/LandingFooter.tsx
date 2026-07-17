interface LandingFooterProps {
  onPrivacidadeClick: () => void;
  onTermosClick: () => void;
}

export default function LandingFooter({ onPrivacidadeClick, onTermosClick }: LandingFooterProps) {
  return (
    <footer className="bg-[#1A1715] text-[#F5F1EA] py-12 px-6 md:px-12 lg:px-20 border-t border-[#A39C92]/10 select-none">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left: Brand & Location */}
        <div 
          style={{ fontFamily: "var(--font-sans)" }} 
          className="text-xs text-[#F5F1EA]/70 text-center md:text-left flex flex-col gap-1"
        >
          <span className="font-bold tracking-widest uppercase">MÉTODO PAME · HOME DETAIL</span>
          <span>Tijucas · Santa Catarina · Brasil</span>
        </div>

        {/* Center: White Logo Icon */}
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 border border-white/20 p-0.5 opacity-80">
            <img
              alt="Logo Método Pame"
              className="w-full h-full object-cover invert"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn"
            />
          </div>
        </div>

        {/* Right: Links, Copyright & Designer Brand */}
        <div 
          style={{ fontFamily: "var(--font-sans)" }} 
          className="text-xs text-[#F5F1EA]/70 text-center md:text-right flex flex-col gap-1.5 items-center md:items-end"
        >
          <div className="flex gap-4">
            <button 
              onClick={onPrivacidadeClick}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacidade
            </button>
            <button 
              onClick={onTermosClick}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Termos
            </button>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-1">
            <span>© 2026 Método Pame.</span>
            <span className="text-[#C9A84C] font-semibold tracking-wider hover:text-white transition-colors">
              bySaintDAC
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
