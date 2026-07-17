export default function LandingHowItWorks() {
  return (
    <section className="relative py-20 md:py-32 px-6 md:px-12 lg:px-20 bg-[#EDE7DC] text-[#1A1715] overflow-hidden">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column (7 cols): Editorial Steps List */}
        <div className="lg:col-span-7 flex flex-col items-start w-full">
          {/* Section Number */}
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 400
            }}
            className="text-sm text-[#C9A84C] tracking-wider uppercase mb-2"
          >
            03
          </span>

          {/* Section Title */}
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.01em"
            }}
            className="text-[clamp(2rem,5vw,3.5rem)] mb-12 text-[#1A1715] leading-[1.1]"
          >
            Como funciona
          </h2>

          <div className="w-full flex flex-col">
            {/* Step 1 */}
            <div className="py-8 w-full flex flex-col md:flex-row md:items-start gap-4 md:gap-8 border-b border-[#A39C92]/40">
              <span
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
                className="text-2xl text-[#C9A84C] leading-none"
              >
                01
              </span>
              <div className="flex flex-col">
                <h3
                  style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
                  className="text-xl md:text-2xl mb-2 text-[#1A1715]"
                >
                  Avaliação da Residência
                </h3>
                <p
                  style={{ fontFamily: "var(--font-sans)", lineHeight: 1.6 }}
                  className="text-sm md:text-base text-[#3D3833] max-w-[50ch]"
                >
                  Você preenche um formulário rápido. Eu preciso entender sua casa: os materiais, a rotina, o que mais te incomoda. Sem isso, não consigo garantir o padrão.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="py-8 w-full flex flex-col md:flex-row md:items-start gap-4 md:gap-8 border-b border-[#A39C92]/40">
              <span
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
                className="text-2xl text-[#C9A84C] leading-none"
              >
                02
              </span>
              <div className="flex flex-col">
                <h3
                  style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
                  className="text-xl md:text-2xl mb-2 text-[#1A1715]"
                >
                  Confirmação com a Pame
                </h3>
                <p
                  style={{ fontFamily: "var(--font-sans)", lineHeight: 1.6 }}
                  className="text-sm md:text-base text-[#3D3833] max-w-[50ch]"
                >
                  Eu leio sua avaliação pessoalmente. Se a sua casa é compatível com o método, eu te confirmo por WhatsApp. Se não for, eu te digo com honestidade — prefiro isso a aceitar um serviço que não posso cuidar bem.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="py-8 w-full flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
              <span
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
                className="text-2xl text-[#C9A84C] leading-none"
              >
                03
              </span>
              <div className="flex flex-col">
                <h3
                  style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
                  className="text-xl md:text-2xl mb-2 text-[#1A1715]"
                >
                  Início do Cuidado Residencial
                </h3>
                <p
                  style={{ fontFamily: "var(--font-sans)", lineHeight: 1.6 }}
                  className="text-sm md:text-base text-[#3D3833] max-w-[50ch]"
                >
                  A partir daí, você agenda pela plataforma. A especialista chega pontualmente, cuida da sua casa como o método exige, e te envia um relatório ao final. Você não precisa supervisionar.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Real Hands Visual */}
        <div className="lg:col-span-5 w-full flex justify-center mt-8 lg:mt-0">
          <div className="w-full max-w-[420px] aspect-[3/4] overflow-hidden">
            <img
              src="/images/pame_hand.jpg"
              alt="Mão esquerda de Pame com suas tatuagens reais de letras e coração, relógio Champion e aliança, arrumando um vaso de vidro sobre uma mesa de mármore de forma extremamente cuidadosa"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
