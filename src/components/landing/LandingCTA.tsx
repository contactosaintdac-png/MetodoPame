import { ApplicationScreen } from '../../types';

interface LandingCTAProps {
  onScreenChange: (screen: ApplicationScreen) => void;
  ctaLabel: string;
  ctaHref: ApplicationScreen;
}

export default function LandingCTA({ onScreenChange, ctaLabel, ctaHref }: LandingCTAProps) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center bg-[#1A1715] overflow-hidden py-24 md:py-36 px-6">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/cta.jpg"
          alt="Banheiro luxuoso de mármore com vista para a natureza verdejante do vale de Tijucas"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Solid Dark Overlay */}
        <div className="absolute inset-0 bg-[#1A1715]/70 z-10" />
      </div>

      {/* Content centered over overlay */}
      <div className="relative z-20 max-w-[800px] mx-auto text-center flex flex-col items-center">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.01em"
          }}
          className="text-white text-[clamp(1.8rem,5vw,3rem)] mb-6 leading-[1.1]"
        >
          Sua casa merece cuidado.<br />
          <span className="block text-[clamp(1rem,3vw,1.5rem)] opacity-90">
            Não improvisação.
          </span>
        </h2>

        <button
          onClick={() => onScreenChange(ctaHref)}
          style={{ fontFamily: "var(--font-sans)", borderRadius: "2px" }}
          className="px-8 py-3 bg-white text-[#561668] hover:bg-[#C9A84C] hover:text-[#1A1715] transition-all font-medium text-base tracking-wider uppercase active:scale-[0.98] cursor-pointer mb-6"
        >
          {ctaLabel} →
        </button>

        <span
          style={{ fontFamily: "var(--font-sans)" }}
          className="text-xs text-white/70"
        >
          Atendimento limitado a Tijucas e região. Vagas abertas mensalmente.
        </span>
      </div>
    </section>
  );
}
