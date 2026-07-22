import { ApplicationScreen } from '../../types';

interface LandingHeroProps {
  onScreenChange: (screen: ApplicationScreen) => void;
  ctaLabel: string;
  ctaHref: ApplicationScreen;
}

export default function LandingHero({ onScreenChange, ctaLabel, ctaHref }: LandingHeroProps) {
  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center bg-[#F5F1EA] text-[#1A1715] pt-24 pb-12 px-6 md:px-12 lg:px-20 overflow-hidden">
      <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left side (60% on desktop) */}
        <div className="lg:col-span-7 flex flex-col items-start justify-center">
          <h2 
            style={{ 
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em"
            }} 
            className="text-[clamp(3rem,8vw,6rem)] mb-6 text-[#1A1715] leading-[1.05]"
          >
            Chegue em casa e respire.
          </h2>

          <p 
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.6 }}
            className="text-base md:text-lg font-normal text-[#3D3833] max-w-[45ch] mb-8"
          >
            Há 10 anos cuido de casas de alto padrão em Tijucas. Seleciono cada candidata, converso pessoalmente com cada uma e capacito antes de enviar. Se eu não confio, não envio.
          </p>

          <button
            onClick={() => onScreenChange(ctaHref)}
            style={{ fontFamily: "var(--font-sans)", borderRadius: "2px" }}
            className="px-[1.75rem] py-[0.875rem] bg-[#561668] text-white hover:bg-[#3D0F4A] transition-all font-semibold text-base tracking-[0.02em] active:scale-[0.98] cursor-pointer"
          >
            {ctaLabel} →
          </button>

          <span 
            style={{ fontFamily: "var(--font-sans)" }}
            className="mt-4 text-sm text-[#6B645C]"
          >
            Atendimento limitado a Tijucas e região. Vagas abertas mensalmente.
          </span>
        </div>

        {/* Right side (40% on desktop) */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <div className="w-full max-w-[450px] aspect-[3/4] overflow-hidden">
            <img
              src="/images/hero.jpg"
              alt="Sala de estar de alto padrão iluminada com tons creme, sofá confortável e mesa de mármore"
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
