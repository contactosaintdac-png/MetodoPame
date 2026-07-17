export default function LandingTestimonial() {
  return (
    <section className="relative py-12 md:py-16 px-6 md:px-12 lg:px-20 bg-[#F5F1EA] text-[#1A1715] overflow-hidden">
      <div className="max-w-[700px] mx-auto">
        <blockquote className="pl-4 border-l border-[#C9A84C]">
          <p 
            style={{ 
              fontFamily: "var(--font-display)", 
              fontStyle: "italic",
              lineHeight: 1.5
            }}
            className="text-2xl md:text-3xl text-[#1A1715] mb-6 leading-relaxed"
          >
            "Passei três anos trocando de diarista. Um dia cansei e entrei em contato com a Pame. A primeira vez que saí de casa enquanto a especialista estava lá, senti uma coisa estranha: paz. Voltei e tudo estava como eu gosto — mas não só limpo. Cuidado."
          </p>
          <cite 
            style={{ fontFamily: "var(--font-sans)" }}
            className="text-xs md:text-sm font-semibold tracking-wider text-[#6B645C] not-italic uppercase"
          >
            — M., cliente ativa, Tijucas
          </cite>
        </blockquote>
      </div>
    </section>
  );
}
