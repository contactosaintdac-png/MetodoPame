import { Firestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function populateLMSData(db: Firestore, onProgress: (msg: string) => void) {
  try {
    onProgress('Iniciando sembrado de datos del LMS...');

    // 1. Módulos
    const modules = [
      {
        id: "mod_01",
        number: 1,
        title: "Boas-vindas ao Método Pame",
        slug: "boas-vindas-ao-metodo-pame",
        description: "Apresentação do método, da Pame e do que significa ser 'do Método'.",
        objective: "Que a especialista entenda o que é o Método Pame, quem é Pame, e o que significa representá-lo numa residência de alto padrão.",
        block: "identidad",
        estimatedMinutes: 30,
        lessons: ["les_01_01", "les_01_02", "les_01_03"],
        evaluationId: "eva_01",
        prerequisiteModuleId: null,
        order: 1,
        status: "published"
      },
      {
        id: "mod_02",
        number: 2,
        title: "Quem é a nossa cliente",
        slug: "quem-e-a-nossa-cliente",
        description: "Conhecer a rotina, medos e expectativas da cliente premium de Tijucas.",
        objective: "Que a candidata conheça a fundo o perfil da cliente de alto padrão e aprenda a antecipar suas necessidades.",
        block: "identidad",
        estimatedMinutes: 45,
        lessons: ["les_02_01", "les_02_02", "les_02_03", "les_02_04"],
        evaluationId: "eva_02",
        prerequisiteModuleId: "mod_01",
        order: 2,
        status: "published"
      },
      {
        id: "mod_03",
        number: 3,
        title: "Postura profissional da especialista",
        slug: "postura-profissional-da-especialista",
        description: "Como se apresentar, se vestir, falar e se comportar na residência.",
        objective: "Garantir que a especialista apresente uma conduta irrepreensível desde o primeiro minuto.",
        block: "postura",
        estimatedMinutes: 45,
        lessons: ["les_03_01", "les_03_02", "les_03_03", "les_03_04"],
        evaluationId: "eva_03",
        prerequisiteModuleId: "mod_02",
        order: 3,
        status: "published"
      },
      {
        id: "mod_04",
        number: 4,
        title: "Pontualidade britânica",
        slug: "pontualidade-britanica",
        description: "Regras de horários de chegada e saída e protocolo de atrasos.",
        objective: "Fixar a cultura de pontualidade absoluta, pilar central da confiança do serviço.",
        block: "postura",
        estimatedMinutes: 20,
        lessons: ["les_04_01", "les_04_02", "les_04_03"],
        evaluationId: "eva_04",
        prerequisiteModuleId: "mod_03",
        order: 4,
        status: "published"
      },
      {
        id: "mod_05",
        number: 5,
        title: "Privacidade e sigilo absoluto",
        slug: "privacidade-e-sigilo-absoluto",
        description: "Regras rígidas sobre uso de celular, fotos e comentários internos.",
        objective: "Blindar a privacidade da cliente em relação a fotos, conversas ou informações internas.",
        block: "conducta",
        estimatedMinutes: 45,
        lessons: ["les_05_01", "les_05_02", "les_05_03", "les_05_04", "les_05_05"],
        evaluationId: "eva_05",
        prerequisiteModuleId: "mod_04",
        order: 5,
        status: "published"
      },
      {
        id: "mod_06",
        number: 6,
        title: "Política de zero uso pessoal",
        slug: "politica-de-zero-uso-pessoal",
        description: "Proibição absoluta do uso de pertences da cliente (comida, perfumes, roupas).",
        objective: "Garantir respeito irrestrito aos pertences e ao patrimônio da cliente.",
        block: "conducta",
        estimatedMinutes: 30,
        lessons: ["les_06_01", "les_06_02", "les_06_03", "les_06_04"],
        evaluationId: "eva_06",
        prerequisiteModuleId: "mod_05",
        order: 6,
        status: "published"
      },
      {
        id: "mod_07",
        number: 7,
        title: "Código de postura residencial",
        slug: "codigo-de-postura-residencial",
        description: "Limites físicos na casa, ambientes permitidos e interação familiar.",
        objective: "Definir a conduta adequada de trânsito e limites dentro do lar da cliente.",
        block: "conducta",
        estimatedMinutes: 40,
        lessons: ["les_07_01", "les_07_02", "les_07_03", "les_07_04", "les_07_05"],
        evaluationId: "eva_07",
        prerequisiteModuleId: "mod_06",
        order: 7,
        status: "published"
      },
      {
        id: "mod_08",
        number: 8,
        title: "Cuidado de mármore e pedras nobres",
        slug: "cuidado-de-marmore-e-pedras-nobres",
        description: "Produtos permitidos/proibidos e técnicas de limpeza de mármores.",
        objective: "Dominar o manuseio químico e mecânico para preservar pedras nobres sem manchar.",
        block: "tecnica",
        estimatedMinutes: 60,
        lessons: ["les_08_01", "les_08_02", "les_08_03", "les_08_04"],
        evaluationId: "eva_08",
        prerequisiteModuleId: "mod_07",
        order: 8,
        status: "published"
      },
      {
        id: "mod_09",
        number: 9,
        title: "Cuidado de madeira maciça e revestimentos nobres",
        slug: "cuidado-de-madeira-macica-e-revestimentos-nobres",
        description: "Preservação de parquets, decks e móveis de madeira maciça.",
        objective: "Aprender as técnicas corretas de hidratação e limpeza de superfícies de madeira.",
        block: "tecnica",
        estimatedMinutes: 45,
        lessons: ["les_09_01", "les_09_02", "les_09_03", "les_09_04"],
        evaluationId: "eva_09",
        prerequisiteModuleId: "mod_08",
        order: 9,
        status: "published"
      },
      {
        id: "mod_10",
        number: 10,
        title: "Cuidado de vidros e espelhos",
        slug: "cuidado-de-vidros-e-espelhos",
        description: "Técnicas de limpeza de vidros comuns e de pé-direito duplo.",
        objective: "Limpar vidros sem deixar marcas ou riscos, mantendo protocolos de segurança.",
        block: "tecnica",
        estimatedMinutes: 45,
        lessons: ["les_10_01", "les_10_02", "les_10_03", "les_10_04"],
        evaluationId: "eva_10",
        prerequisiteModuleId: "mod_09",
        order: 10,
        status: "published"
      },
      {
        id: "mod_11",
        number: 11,
        title: "Cuidado de metais, grifería e inox",
        slug: "cuidado-de-metais-griferia-e-inox",
        description: "Polimento de metais finos e griferias sem riscos.",
        objective: "Aplicar polimento sem marcas em torneiras, metais e superfícies de inox.",
        block: "tecnica",
        estimatedMinutes: 35,
        lessons: ["les_11_01", "les_11_02", "les_11_03", "les_11_04"],
        evaluationId: "eva_11",
        prerequisiteModuleId: "mod_10",
        order: 11,
        status: "published"
      },
      {
        id: "mod_12",
        number: 12,
        title: "Protocolo de limpeza por ambiente",
        slug: "protocolo-de-limpeza-por-ambiente",
        description: "Checklist detalhado e ordem correta para cozinha, banheiros e salas.",
        objective: "Aprender a ordem exata de execução por ambiente para otimização do tempo.",
        block: "tecnica",
        estimatedMinutes: 90,
        lessons: ["les_12_01", "les_12_02", "les_12_03", "les_12_04", "les_12_05", "les_12_06"],
        evaluationId: "eva_12",
        prerequisiteModuleId: "mod_11",
        order: 12,
        status: "published"
      },
      {
        id: "mod_13",
        number: 13,
        title: "O capricho Pame",
        slug: "o-capricho-pame",
        description: "Detalhes autorais do padrão Método Pame que encantam a cliente.",
        objective: "Interiorizar o olhar de detalhe que separa a diarista comum da especialista do método.",
        block: "estandar",
        estimatedMinutes: 40,
        lessons: ["les_13_01", "les_13_02", "les_13_03", "les_13_04"],
        evaluationId: "eva_13",
        prerequisiteModuleId: "mod_12",
        order: 13,
        status: "published"
      },
      {
        id: "mod_14",
        number: 14,
        title: "Reporte interno — como reportar a Pame",
        slug: "reporte-interno-como-reportar-a-pame",
        description: "Comunicação de entradas, saídas, incidentes e quebras.",
        objective: "Padronizar o canal e fluxo de comunicação operacional direta com a Pame.",
        block: "operacion",
        estimatedMinutes: 35,
        lessons: ["les_14_01", "les_14_02", "les_14_03", "les_14_04", "les_14_05"],
        evaluationId: "eva_14",
        prerequisiteModuleId: "mod_13",
        order: 14,
        status: "published"
      },
      {
        id: "mod_15",
        number: 15,
        title: "Conduta em situações difíceis",
        slug: "conduta-em-situacoes-dificeis",
        description: "Protocolos para quebras de objetos caros ou reclamações de clientes.",
        objective: "Agir com serenidade e profissionalismo seguindo o plano de contenção de danos.",
        block: "operacion",
        estimatedMinutes: 50,
        lessons: ["les_15_01", "les_15_02", "les_15_03", "les_15_04", "les_15_05"],
        evaluationId: "eva_15",
        prerequisiteModuleId: "mod_14",
        order: 15,
        status: "published"
      }
    ];

    for (const m of modules) {
      await setDoc(doc(db, 'modules', m.id), {
        ...m,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onProgress(`Módulo ${m.number} creado: ${m.title}`);
    }

    // 2. Lecciones (59 lecciones en total)
    // Generaremos las 59 lecciones vacías (placeholders) de forma estructurada
    onProgress('Sembrando 59 lecciones...');
    for (const m of modules) {
      for (let i = 1; i <= m.lessons.length; i++) {
        const lessonId = `les_${String(m.number).padStart(2, '0')}_${String(i).padStart(2, '0')}`;
        const lessonData = {
          id: lessonId,
          moduleId: m.id,
          number: i,
          title: `Lição ${i} do Módulo ${m.number}: [TÍTULO PROVISÓRIO]`,
          type: 'reading',
          content: `## Lição ${i}: [TÍTULO PROVISÓRIO]\n\nEste é o conteúdo inicial estruturado pela plataforma.\n\n[CONTEÚDO PENDENTE — RESPOSTA DA PAME]\n\nPor favor, aguarde a liberação do material completo.`,
          videoUrl: null,
          videoDurationSeconds: null,
          estimatedMinutes: 5,
          completionCriteria: {
            type: 'manual_confirmation',
            buttonLabel: 'Marcar como lida',
            requiresVideoWatch: false
          },
          order: i,
          status: 'published'
        };
        
        // Algunos detalles específicos que ya conocemos por documentación
        if (m.id === 'mod_08' && i === 2) {
          lessonData.title = 'Produtos proibidos em mármore';
          lessonData.content = `## Produtos Proibidos em Mármore\n\nO mármore é uma rocha metamórfica composta principalmente de carbonato de cálcio. Isso o torna extremamente vulnerável a ácidos e abrasivos químicos.\n\n### Lista de Produtos Estritamente PROIBIDOS:\n- **Ácidos naturais:** Limão, vinagre, suco de laranja.\n- **Produtos comerciais:** Cloro ativo, sapólio, água sanitária pura, limpadores multiuso ácidos, produtos para limpar limo (WC Net, etc.).\n- **Abrasivos mecânicos:** Esponjas verdes de cozinha, palha de aço.\n\n### O que acontece se usar?\nO ácido reage instantaneamente, corroendo a rocha. A superfície perde o polimento, fica áspera e mancha. Essa mancha não sai com limpeza normal; exige polimento mecânico profissional que custa caro.\n\n[CONTEÚDO PENDENTE — RESPOSTA DA PAME]`;
        }

        await setDoc(doc(db, 'lessons', lessonId), {
          ...lessonData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      onProgress(`Lecciones del Módulo ${m.number} creadas.`);
    }

    // 3. Evaluaciones (15 en total - una por módulo)
    onProgress('Sembrando evaluaciones con preguntas de prueba...');
    for (const m of modules) {
      // Creamos 4 preguntas de prueba para cada evaluación de módulo
      const questions = [
        {
          id: `q_${String(m.number).padStart(2, '0')}_01`,
          type: 'multiple_choice',
          question: `[Módulo ${m.number}] Qual é a regra fundamental do Método Pame sobre este tema?`,
          options: [
            "Fazer o trabalho da forma mais rápida possível.",
            "Seguir estritamente o protocolo de alto padrão e respeitar a privacidade.",
            "Usar qualquer produto que remova a sujeira rápido.",
            "Deixar para reportar problemas apenas no final do mês."
          ],
          correctOptionIndex: 1,
          expectedAnswerKeywords: null,
          feedback: "O Método Pame preza pela excelência técnica, postura discreta e respeito absoluto ao patrimônio da cliente.",
          points: 1,
          order: 1
        },
        {
          id: `q_${String(m.number).padStart(2, '0')}_02`,
          type: 'multiple_choice',
          question: `[Módulo ${m.number}] Se houver alguma dúvida técnica na execução de uma tarefa, o que fazer?`,
          options: [
            "Tentar resolver sozinho usando o bom senso.",
            "Perguntar diretamente para o marido da cliente.",
            "Consultar imediatamente o manual no aplicativo ou enviar mensagem urgente para a Pame.",
            "Ignorar a tarefa e passar para a próxima."
          ],
          correctOptionIndex: 2,
          expectedAnswerKeywords: null,
          feedback: "Erros em superfícies nobres são irreversíveis. Em caso de dúvida, consulte a Pame antes de agir.",
          points: 1,
          order: 2
        },
        {
          id: `q_${String(m.number).padStart(2, '0')}_03`,
          type: 'open_short',
          question: `[Módulo ${m.number}] Explique brevemente por que a discrição e a privacidade são vitais para as clientes atendidas pelo método.`,
          options: null,
          correctOptionIndex: null,
          expectedAnswerKeywords: ["confiança", "privacidade", "segurança", "silêncio", "respeito"],
          feedback: "As clientes de alto padrão compram paz mental e privacidade. Qualquer quebra de sigilo destrói a relação comercial.",
          points: 1,
          order: 3
        },
        {
          id: `q_${String(m.number).padStart(2, '0')}_04`,
          type: 'scenario',
          question: `[Módulo ${m.number}] Cenário Prático: Você nota um arranhão leve num móvel de madeira nobre que você acabou de limpar. Como você gerencia essa situação com o reporte interno?`,
          options: null,
          correctOptionIndex: null,
          expectedAnswerKeywords: ["foto", "avisar Pame", "reportar", "imediatamente", "honestidade"],
          feedback: "O protocolo de incidentes exige tirar uma foto imediatamente, reportar à Pame com honestidade e registrar o horário da ocorrência.",
          points: 2,
          order: 4
        }
      ];

      // Sobrescribir preguntas con preguntas de mármol reales para el módulo 8
      if (m.id === 'mod_08') {
        questions[0] = {
          id: 'q_08_01',
          type: 'multiple_choice',
          question: "Qual destes produtos é terminantemente PROIBIDO em mármores e pedras nobres?",
          options: [
            "Detergente neutro diluído em água morna",
            "Vinagre de álcool ou suco de limão",
            "Pano de microfibra macio",
            "Água pura morna"
          ],
          correctOptionIndex: 1,
          expectedAnswerKeywords: null,
          feedback: "Ácidos (como vinagre e limão) corroem quimicamente o carbonato de cálcio do mármore, danificando o polimento da pedra de forma irreversível.",
          points: 1,
          order: 1
        };
        questions[1] = {
          id: 'q_08_02',
          type: 'multiple_choice',
          question: "Qual é a técnica correta de secagem de uma superfície de mármore após a higienização?",
          options: [
            "Deixar secar naturalmente com o vento.",
            "Secar imediatamente com um pano de microfibra limpo e seco, sem deixar umidade.",
            "Usar secador de cabelo em temperatura máxima.",
            "Passar um pano úmido e deixar secar sozinho."
          ],
          correctOptionIndex: 1,
          expectedAnswerKeywords: null,
          feedback: "A umidade parada pode penetrar nos poros do mármore e criar manchas escuras difíceis de remover. A secagem deve ser imediata.",
          points: 1,
          order: 2
        };
      }

      await setDoc(doc(db, 'evaluations', m.evaluationId), {
        id: m.evaluationId,
        moduleId: m.id,
        title: `Avaliação — Módulo ${m.number}: ${m.title}`,
        description: `Esta avaliação contém 4 perguntas para validar sua compreensão sobre o conteúdo estudado. Pontuação mínima para aprovação: 70%.`,
        passingScorePercent: 70,
        questions,
        totalQuestions: questions.length,
        estimatedMinutes: 10,
        maxAttempts: 2,
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    onProgress('Todas las evaluaciones de módulo creadas.');

    // 4. Preguntas del examen final (de síntesis)
    onProgress('Sembrando preguntas de síntesis para el examen final...');
    const finalExamQuestions = [
      {
        id: 'q_final_01',
        moduleId: 'final_exam',
        type: 'multiple_choice',
        question: "De forma geral, o que define a filosofia do Método Pame em relação ao cuidado de residências de luxo?",
        options: [
          "Limpar tudo o mais rápido possível para liberar a agenda.",
          "Cuidar da residência como um santuário, preservando o patrimônio físico e a privacidade cognitiva da cliente.",
          "Usar produtos químicos fortes para garantir que o perfume dure dias.",
          "Focar apenas nos quartos e banheiros, deixando as áreas sociais para o final."
        ],
        correctOptionIndex: 1,
        expectedAnswerKeywords: null,
        feedback: "A filosofia central é o 'Quiet Luxury' do lar: silêncio, discrição, cuidado obsessivo com superfícies caras e proteção da intimidade.",
        points: 1,
        order: 1,
        status: 'published'
      },
      {
        id: 'q_final_02',
        moduleId: 'final_exam',
        type: 'open_short',
        question: "Se você acidentalmente derrubar um frasco de perfume importado no banheiro principal e ele quebrar, qual o procedimento completo segundo as regras de Conduta e Reporte?",
        options: null,
        correctOptionIndex: null,
        expectedAnswerKeywords: ["foto", "avisar Pame", "não esconder", "limpar com cuidado", "registrar"],
        feedback: "O protocolo exige: segurança imediata para não cortar ninguém, tirar foto do incidente, avisar a Pame imediatamente no mesmo momento, e registrar o ocorrido no reporte de saída.",
        points: 1,
        order: 2,
        status: 'published'
      },
      {
        id: 'q_final_03',
        moduleId: 'final_exam',
        type: 'scenario',
        question: "Cenário Completo: Uma cliente pede para você fazer a lavagem rápida de um tapete de lã feito à mão usando sabão em pó comum. Você sabe que o sabão vai manchar e ressecar as fibras. O que você faz, como fala com ela e quem avisa?",
        options: null,
        correctOptionIndex: null,
        expectedAnswerKeywords: ["não fazer", "explicar com educação", "consultar Pame", "protocolo", "superfície"],
        feedback: "O protocolo proíbe realizar procedimentos de risco sem aprovação. Explique com educação e elegância à cliente que o método exige um cuidado específico para tapetes artesanais, não realize o serviço e avise a Pame imediatamente.",
        points: 2,
        order: 3,
        status: 'published'
      }
    ];

    for (const q of finalExamQuestions) {
      await setDoc(doc(db, 'final_exam_questions', q.id), {
        ...q,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    onProgress('Sembrado finalizado con éxito total. Módulos y lecciones listos.');
  } catch (err: any) {
    console.error('Error al sembrar datos del LMS:', err);
    onProgress(`ERROR: ${err.message || err}`);
    throw err;
  }
}
