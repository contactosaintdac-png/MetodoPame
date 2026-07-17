import { ApplicationScreen } from '../../types';
import LandingHeader from './LandingHeader';
import LandingHero from './LandingHero';
import LandingAbout from './LandingAbout';
import LandingForWhom from './LandingForWhom';
import LandingHowItWorks from './LandingHowItWorks';
import LandingTestimonial from './LandingTestimonial';
import LandingFAQ from './LandingFAQ';
import LandingCTA from './LandingCTA';
import LandingFooter from './LandingFooter';

interface LandingPageProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function LandingPage({ onScreenChange }: LandingPageProps) {
  // Determine CTA config based on launcher state
  const isLaunched = import.meta.env.VITE_LMS_LAUNCHED === 'true';
  const ctaLabel = isLaunched ? 'Realizar Avaliação da Residência' : 'Entrar na lista de espera';
  const ctaHref: ApplicationScreen = isLaunched ? 'triage' : 'waitlist';

  const handleOpenPrivacy = () => {
    window.dispatchEvent(new Event('open-privacy-modal'));
  };

  const handleOpenTerms = () => {
    window.dispatchEvent(new Event('open-terms-modal'));
  };

  return (
    <div className="w-full min-h-screen text-[#1A1715] flex flex-col font-sans selection:bg-[#561668] selection:text-white relative">
      {/* Header (sticky or absolute) */}
      <LandingHeader onScreenChange={onScreenChange} />

      {/* Hero Section */}
      <LandingHero 
        onScreenChange={onScreenChange} 
        ctaLabel={ctaLabel} 
        ctaHref={ctaHref}
      />

      {/* Section 1: Quem é a Pame */}
      <LandingAbout />

      {/* Section 2: Para quem é */}
      <LandingForWhom />

      {/* Section 3: Como funciona */}
      <LandingHowItWorks />

      {/* Section 4: Depoimento */}
      <LandingTestimonial />  

      {/* Section 5: Perguntas (FAQ) */}
      <LandingFAQ />

      {/* Section 6: CTA Final */}
      <LandingCTA 
        onScreenChange={onScreenChange} 
        ctaLabel={ctaLabel} 
        ctaHref={ctaHref}
      />

      {/* Footer */}
      <LandingFooter 
        onPrivacidadeClick={handleOpenPrivacy} 
        onTermosClick={handleOpenTerms} 
      />
    </div>
  );
}