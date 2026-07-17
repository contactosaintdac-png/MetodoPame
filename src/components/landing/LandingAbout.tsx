export default function LandingAbout() {
  return (
    <section className="relative py-20 md:py-32 px-6 md:px-12 lg:px-20 bg-[#EDE7DC] text-[#1A1715] overflow-hidden">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left side (40% on desktop) - Real portrait of Pame */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <div className="w-full max-w-[420px] aspect-[3/4] overflow-hidden">
            <img
              src="/images/pame.jpg"
              alt="Pame, fundadora do Método Pame, sorrindo de forma acolhedora com camiseta da marca"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>

        {/* Right side (60% on desktop) - Letter/Story */}
        <div className="lg:col-span-7 flex flex-col items-start pt-2">
          {/* Section Number */}
          <span 
            style={{ 
              fontFamily: "var(--font-display)", 
              fontStyle: "italic", 
              fontWeight: 400 
            }} 
            className="text-sm text-[#C9A84C] tracking-wider uppercase mb-2"
          >
            01
          </span>

          {/* Section Title */}
          <h2 
            style={{ 
              fontFamily: "var(--font-display)", 
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.01em"
            }} 
            className="text-3xl md:text-5xl mb-8 text-[#1A1715]"
          >
            Eu sou a Pame.
          </h2>

          {/* Story paragraphs */}
          <div 
            style={{ fontFamily: "var(--font-sans)", lineHeight: 1.7 }}
            className="text-base text-[#1A1715] max-w-[58ch] space-y-6"
          >
            <p>
              Comecei cuidando de casas de outras pessoas antes de saber que isso era um dom.
            </p>
            <p>
              Há 10 anos, entro em residências de alto padrão em Tijucas e trato cada uma como se fosse minha. Ou melhor: como se fosse da minha mãe, que me ensinou que casa arrumada é casa respeitada.
            </p>
            <p>
              O método nasceu de uma coisa simples. Eu cansei de ver mulheres sendo mal atendidas. Diaristas que faltam. Produtos que destroem o mármore. Pessoas que não entendem que entrar na casa de alguém é um privilégio, não só um trabalho.
            </p>
            <p>
              Então eu criei um jeito diferente. Não é empresa de limpeza. É um sistema de cuidado. Eu seleciono cada candidata, converso pessoalmente com cada uma, capacito antes de enviar. Se não confio, não envio.
            </p>
            <p>
              Hoje, o Método Pame cuida de casas em Tijucas com o mesmo critério que eu uso na minha. E é isso que eu quero para você: que sua casa seja cuidada como se fosse minha.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
