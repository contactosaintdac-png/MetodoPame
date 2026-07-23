import type { ApplicationScreen } from '../../types';
import pamePortrait from '../../../assets/fotos/Retratos/Retrato Pame (17).jpeg';
import './landing.css';

interface LandingPageProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

const faqs = [
  {
    question: 'Quanto custa?',
    answer: 'O valor depende do tamanho da sua residência e da frequência. Serviços avulsos começam em R$ 350. Pacotes mensais a partir de R$ 1.200. Mas antes de falar de preço, eu preciso entender sua casa. Por isso começa com a Avaliação da Residência.'
  },
  {
    question: 'Vocês atendem em qual região?',
    answer: 'Atualmente, apenas Tijucas e regiões imediatamente próximas. Manter o padrão exige cuidar da zona de operação. Se você é de Itapema ou Balneário Camboriú, deixe seu contato na lista de espera que eu aviso quando abrir sua zona.'
  },
  {
    question: 'Como sei que posso confiar?',
    answer: 'Cada candidata passa por CPF, antecedentes criminais, experiência comprovada, referências de trabalhos anteriores, entrevista pessoal comigo e capacitação obrigatória antes de entrar no sistema. A frase que me define é: se eu não confio, não envio.'
  },
  {
    question: 'Preciso estar em casa durante o serviço?',
    answer: 'Não. A maioria das minhas clientes não está. A ideia é que você possa se sentir tranquila ao delegar. Nas primeiras visitas, algumas preferem estar. Com o tempo, isso não é mais necessário.'
  },
  {
    question: 'Quais produtos vocês usam?',
    answer: 'Em casas de alto padrão, geralmente usamos os produtos que a cliente já aprovou, especialmente em superfícies delicadas como mármore, madeira maciça e vidros importados. Quando necessário, eu oriento sobre o uso correto para evitar danos.'
  }
];

function CtaButton({ onScreenChange, inverse = false }: { onScreenChange: LandingPageProps['onScreenChange']; inverse?: boolean }) {
  return (
    <button
      type="button"
      className={`landing-cta${inverse ? ' landing-cta--inverse' : ''}`}
      onClick={() => onScreenChange('waitlist')}
    >
      Entrar na lista de espera <span aria-hidden="true">→</span>
    </button>
  );
}

export default function LandingPage({ onScreenChange }: LandingPageProps) {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand-pill" href="/" aria-label="Método Pame, início">
          <img src="/logo.png" alt="Método Pame | Home Detail" />
          <span>Cuidado residencial</span>
        </a>
        <nav className="landing-nav" aria-label="Navegação principal">
          <a href="#o-metodo">O método</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#perguntas">Perguntas</a>
        </nav>
        <button type="button" className="landing-client-link" onClick={() => onScreenChange('acesso')}>Já sou cliente <span aria-hidden="true">→</span></button>
      </header>

      <main>
        <section className="landing-hero landing-section" aria-labelledby="hero-title">
          <div className="landing-hero__copy">
            <span className="landing-hero__kicker">Método Pame · Tijucas, SC</span>
            <h1 id="hero-title"><span>Chegue</span><span>em casa e</span><span>respire.</span></h1>
            <p className="landing-lede">Há 10 anos cuido de casas de alto padrão em Tijucas. Seleciono cada candidata, converso pessoalmente com cada uma e capacito antes de enviar. Se eu não confio, não envio.</p>
            <div className="landing-hero__action">
              <CtaButton onScreenChange={onScreenChange} />
              <p className="landing-fineprint">Atendimento limitado a Tijucas e região.<br />Vagas abertas mensalmente.</p>
            </div>
          </div>
          <div className="landing-hero__art" aria-label="Casa de alto padrão cuidada pelo Método Pame">
            <div className="landing-hero__orbit" aria-hidden="true" />
            <div className="landing-hero__image">
              <img src="/waitlist_luxury.png" alt="Sala de estar de alto padrão com sofá branco e mesa de mármore" fetchPriority="high" />
            </div>
            <div className="landing-hero__seal"><strong>10</strong><span>anos de<br />experiência</span></div>
            <div className="landing-hero__promise">Se eu não confio,<br /><strong>não envio.</strong></div>
          </div>
        </section>

        <div className="landing-ribbon" aria-hidden="true">
          <div><span>CRITÉRIO</span><i /><span>CONFIANÇA</span><i /><span>CUIDADO</span><i /><span>PRIVACIDADE</span><i /><span>CRITÉRIO</span><i /><span>CONFIANÇA</span></div>
        </div>

        <section id="o-metodo" className="landing-section landing-section--stone landing-about" aria-labelledby="about-title">
          <div className="landing-about__image">
            <img src={pamePortrait} alt="Pamela Mota, fundadora do Método Pame" loading="lazy" />
            <span className="landing-about__name" aria-hidden="true">PAME</span>
            <div className="landing-about__badge">Fundadora<br />do método</div>
          </div>
          <div className="landing-copy landing-about__copy">
            <span className="landing-section-number">01</span>
            <h2 id="about-title">Eu sou a Pame.</h2>
            <p>Comecei cuidando de casas de outras pessoas antes de saber que isso era um dom.</p>
            <p>Há 10 anos, entro em residências de alto padrão em Tijucas e trato cada uma como se fosse minha. Ou melhor: como se fosse da minha mãe, que me ensinou que casa arrumada é casa respeitada.</p>
            <p>O método nasceu de uma coisa simples. Eu cansei de ver mulheres sendo mal atendidas. Diaristas que faltam. Produtos que destroem o mármore. Pessoas que não entendem que entrar na casa de alguém é um privilégio, não só um trabalho.</p>
            <p>Então eu criei um jeito diferente. Não é empresa de limpeza. É um sistema de cuidado. Eu seleciono cada candidata, converso pessoalmente com cada uma, capacito antes de enviar. Se não confio, não envio.</p>
            <p>Hoje, o Método Pame cuida de casas em Tijucas com o mesmo critério que eu uso na minha. E é isso que eu quero para você: que sua casa seja cuidada como se fosse minha.</p>
          </div>
        </section>

        <section className="landing-section landing-for-whom" aria-labelledby="for-whom-title">
          <div className="landing-narrow-copy">
            <span className="landing-section-number">02</span>
            <h2 id="for-whom-title">Para quem é o Método Pame</h2>
            <div className="landing-contrast-block">
              <div>
                <p>É para você se a sua casa de alto padrão já não aguenta ser cuidada por improvisação.</p>
                <p>É para você se já passou por experiências ruins e não quer mais correr riscos.</p>
                <p>É para você se valoriza mais a tranquilidade do que o preço mais baixo.</p>
                <p>É para você se quer delegar o cuidado da casa para alguém em quem confia, sem ter que supervisionar.</p>
              </div>
              <div className="landing-contrast-block__muted">
                <p>Não é para você se está procurando a faxina mais barata da região.</p>
                <p>Não é para você se não quer passar por um processo de admissão antes de contratar.</p>
                <p>Não é para você se espera que eu mande qualquer pessoa disponível, sem critério.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="landing-section landing-section--stone landing-how" aria-labelledby="how-title">
          <div className="landing-narrow-copy">
            <span className="landing-section-number">03</span>
            <h2 id="how-title">Como funciona</h2>
            <ol className="landing-process">
              <li className="landing-process__lead">
                <span className="landing-process__number">01</span>
                <div><h3>Avaliação da Residência</h3><p>Você preenche um formulário rápido. Eu preciso entender sua casa: os materiais, a rotina, o que mais te incomoda. Sem isso, não consigo garantir o padrão.</p></div>
              </li>
              <li>
                <span className="landing-process__number">02</span>
                <div><h3>Confirmação com a Pame</h3><p>Eu leio sua avaliação pessoalmente. Se a sua casa é compatível com o método, eu te confirmo por WhatsApp. Se não for, eu te digo com honestidade. Prefiro isso a aceitar um serviço que não posso cuidar bem.</p></div>
              </li>
              <li>
                <span className="landing-process__number">03</span>
                <div><h3>Início do Cuidado Residencial</h3><p>A partir daí, você agenda pela plataforma. A especialista chega pontualmente, cuida da sua casa como o método exige, e te envia um relatório ao final. Você não precisa supervisionar.</p></div>
              </li>
            </ol>
          </div>
        </section>

        <section className="landing-section landing-testimonial" aria-labelledby="testimonial-title">
          <div className="landing-narrow-copy">
            <span className="landing-section-number">Uma palavra da Pame</span>
            <h2 id="testimonial-title" className="sr-only">Uma palavra da Pame</h2>
            <span className="landing-quote-mark" aria-hidden="true">“</span>
            <blockquote>“Cuidar uma casa é entender que cada detalhe também guarda uma história.”</blockquote>
            <cite>— Pamela Mota, fundadora do Método Pame</cite>
          </div>
        </section>

        <section id="perguntas" className="landing-section landing-section--stone landing-faq" aria-labelledby="faq-title">
          <div className="landing-narrow-copy">
            <span className="landing-section-number">04</span>
            <h2 id="faq-title">Perguntas</h2>
            <div className="landing-faq__list">
              {faqs.map((faq) => (
                <div className="landing-faq__item" key={faq.question}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <div className="landing-final-cta__image" aria-hidden="true" />
          <div className="landing-final-cta__content">
            <h2 id="final-cta-title">Sua casa merece cuidado.<br /><span>Não improvisação.</span></h2>
            <CtaButton onScreenChange={onScreenChange} inverse />
            <p className="landing-fineprint">Atendimento limitado a Tijucas e região. Vagas abertas mensalmente.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div><strong>MÉTODO PAME · HOME DETAIL</strong><span>Tijucas · Santa Catarina · Brasil</span></div>
        <img src="/logo.png" alt="Método Pame" />
        <div className="landing-footer__right"><span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-modal'))}>Privacidade</button> · <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}>Termos</button></span><span>© 2026 Método Pame. Todos os direitos reservados.</span><small>Designed &amp; developed bySaintDAC</small></div>
      </footer>
    </div>
  );
}
