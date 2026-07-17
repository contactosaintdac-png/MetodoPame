import { ApplicationScreen } from '../../types';
import { useEffect, useState } from 'react';

interface LandingHeaderProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function LandingHeader({ onScreenChange }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    // Initialize on mount
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`absolute top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-6 md:px-12 md:py-8 select-none ${scrolled ? 'bg-[#F5F1EA]' : 'bg-transparent'}`}>
      {/* Brand logo left */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-[#efe5ee]">
          <img
            alt="Logo Método Pame"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn"
          />
        </div>
        <span
          style={{ fontFamily: "var(--font-display)" }}
          className="text-lg md:text-xl font-normal tracking-wide text-[#1A1715]"
        >
          MÉTODO PAME
        </span>
      </div>

      {/* Access link right */}
      <button
        onClick={() => onScreenChange('acesso')}
        style={{ fontFamily: "var(--font-sans)" }}
        className="text-[11px] md:text-xs font-semibold tracking-wider text-[#561668] hover:text-[#3D0F4A] transition-colors uppercase border-b border-transparent hover:border-[#561668] pb-0.5 cursor-pointer"
      >
        Já sou cliente →
      </button>
    </header>
  );
}
