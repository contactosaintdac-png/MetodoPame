export default function LandingFAQ() {
  const faqs = [
    {
      q: "Quanto custa?",
      a: "O valor depende do tamanho da sua residência e da frequência. Serviços avulsos começam em R$ 350. Pacotes mensais a partir de R$ 1.200. Mas antes de falar de preço, eu preciso entender sua casa. Por isso começa com a Avaliação da Residência."
    },
    {
      q: "Vocês atendem em qual região?",
      a: "Atualmente, apenas Tijucas e regiões imediatamente próximas. Manter o padrão exige cuidar da zona de operação. Se você é de Itapema ou Balneário Camboriú, deixe seu contato na lista de espera que eu aviso quando abrir sua zona."
    },
    {
      q: "Como sei que posso confiar?",
      a: "Cada candidata passa por CPF, antecedentes criminais, experiência comprovada, referências de trabalhos anteriores, entrevista pessoal comigo e capacitação obrigatória antes de entrar no sistema. A frase que me define é: se eu não confio, não envio."
    },
    {
      q: "Preciso estar em casa durante o serviço?",
      a: "Não. A maioria das minhas clientes não está. A ideia é que você possa sentir tranquila ao delegar. Nas primeiras visitas, algumas preferem estar. Com o tempo, isso não é mais necessário."
    },
    {
      q: "Quais produtos vocês usam?",
      a: "Em casas de alto padrão, geralmente usamos os produtos que a cliente já aprovou, especialmente em superfícies delicadas como mármore, madeira maciça e vidros importados. Quando necessário, eu oriento sobre o uso correto para evitar danos."
    }
  ];

  return (
    <section className="relative py-20 md:py-32 px-6 md:px-12 bg-[#EDE7DC] text-[#1A1715] overflow-hidden">
      <div className="max-w-[700px] mx-auto flex flex-col items-start">
        {/* Section Number */}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400
          }}
          className="text-sm text-[#C9A84C] tracking-wider uppercase mb-2"
        >
          04
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
          Perguntas
        </h2>

        {/* FAQ list */}
        <div className="w-full flex flex-col">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`py-6 w-full flex flex-col items-start gap-3 border-t border-[#A39C92]/40 ${index === faqs.length - 1 ? 'border-b' : ''}`}
            >
              <h3
                style={{ fontFamily: "var(--font-sans)" }}
                className="text-base font-medium text-[#1A1715] tracking-tight"
              >
                {faq.q}
              </h3>
              <p
                style={{ fontFamily: "var(--font-sans)", lineHeight: 1.7 }}
                className="text-sm text-[#3D3833] max-w-[65ch]"
              >
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
