export default function LandingForWhom() {
  return (
    <section className="relative py-20 md:py-32 px-6 md:px-12 lg:px-20 bg-[#F5F1EA] text-[#1A1715] overflow-hidden">
      <div className="max-w-[800px] mx-auto flex flex-col items-start">
        {/* Section Number */}
        <span 
          style={{ 
            fontFamily: "var(--font-display)", 
            fontStyle: "italic", 
            fontWeight: 400 
          }} 
          className="text-sm text-[#C9A84C] tracking-wider uppercase mb-2"
        >
          02
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
          Para quem é o Método Pame
        </h2>

        {/* Block 1 — É para você se */}
        <div 
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.7 }}
          className="text-base leading-[1.7] text-[#1A1715] space-y-6 w-full max-w-[55ch]"
        >
          <p>
            É para você se a sua casa de alto padrão já não aguenta ser cuidada por improvisação.
          </p>
          <p>
            É para você se já passou por experiências ruins e não quer mais correr riscos.
          </p>
          <p>
            É para você se valoriza mais a tranquilidade do que o preço mais baixo.
          </p>
          <p>
            É para você se quer delegar o cuidado da casa para alguém em quem confia, sem ter que supervisionar.
          </p>
        </div>

        {/* Divisor Hairline */}
        <hr className="w-full my-12 border-t border-[#D4CFC6]" />

        {/* Block 2 — Não é para você se */}
        <div 
          style={{ fontFamily: "var(--font-sans)", lineHeight: 1.7 }}
          className="text-base leading-[1.7] text-[#6B645C] space-y-6 w-full max-w-[55ch]"
        >
          <p>
            Não é para você se está procurando a faxina mais barata da região.
          </p>
          <p>
            Não é para você se não quer passar por um processo de admissão antes de contratar.
          </p>
          <p>
            Não é para você se espera que eu mande qualquer pessoa disponível, sem critério.
          </p>
        </div>
      </div>
    </section>
  );
}
