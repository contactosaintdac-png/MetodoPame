# pame-architecture-spec.md

---

## Estructura de la Plataforma: Módulo Pame Home Detail
**Ecosistema Digital Auto-Gestionable para el Mercado de Alto Padrón en Tijucas, SC**

---

## 1. Arquitectura de Entrada: Segmentación y Gated Flow

El sitio web está dividido de forma asimétrica desde la raíz para separar el bardo de la captación de funcionarias del flujo de conversión de clientes adinerados.

### Pantalla de Entrada (Split Minimalista)
- **Bloque Izquierdo (Estética Quiet Luxury):** "Quero contratar o Módulo Pame para a minha residência" ➔ Direcciona al Filtro Triage de Clientes.
- **Bloque Derecho (Limpio, Institucional):** "Quero fazer parte da equipe de especialistas Pame" ➔ Direcciona al Portal de Reclutamiento Protegido.

---

## 2. Sección del Cliente: El Peaje de Triage Invisible

Para el cliente de alto patrón, el precio no es público de entrada. Mostrar tarifas sin calificar devalúa el servicio y lo convierte en un commoditie. El valor se despliega únicamente tras pasar este formulario dinámico de 4 etapas.

### El Cuestionario de Cualificación Condicional
1. **La Pregunta Matadora:** ¿Quando foi a última faxina detalhada na sua residência?
   - *Menos de 7 dias* (Mantenimiento estándar).
   - *Mais de 15 dias* (Estructura con acumulación).
   - *Mais de 30 dias / Pós-obra* (Requiere choque técnico inicial).
2. **Dimensión de la Infraestructura:** ¿Qual é o tamanho da sua estrutura actual?
   - [Selector numérico] NÚMERO DE QUARTOS.
   - [Selector numérico] NÚMERO DE BANHEIROS.
3. **Cuidado de Materiales Nobles (Anclaje de Estatus):** ¿A sua casa possui superfícies que exigem tratamento cirúrgico?
   - [ ] Mármore / Granito importado.
   - [ ] Madeira maciça / Parquet.
   - [ ] Vidros de pé-direito duplo.
   - [ ] Objetos de prata, couro ou cristais de luxo.
4. **Frecuencia Operativa Deseada:** ¿Qual é a regularidade ideal para proteger o seu lar?
   - [ ] Manutenção Mensal Planejada (Recomendado para Alto Padrón).
   - [ ] Serviço Individual Avulso.

---

## 3. Matriz de Precios e Incentivo Lógico (Decoy Pricing)

Cuando el cliente completa el Triage, el software ejecuta la inyección de la lógica comercial. Elevamos el valor individual para volver obvio, inteligente y obligatorio el cierre del paquete mensual.

| Formato de Turno | Opción Individual (Avulso) | Paquete Mensal (4 Sesiones) | Costo por Sesión en Paquete | Ahorro Real Mensual |
| :--- | :--- | :--- | :--- | :--- |
| **Meio Turno** (4h)<br>*08:00 - 12:00 \| 13:00 - 17:00* | R$ 250 | **R$ 800** | R$ 200 | R$ 200 |
| **Turno Completo** (9h)<br>*08:00 - 17:00* | R$ 400 | **R$ 1.000** | R$ 250 | R$ 600 |

### Servicios Adicionales de Alta Gama (Add-ons: +R$ 50 cada uno)
Para el público con dinero en Tijucas, sumamos sugerencias de "Detalle" que las agencias comunes no hacen. No es limpiar; es curar la casa.
- **Dobra de roupas técnica:** Organización en cajones bajo método de archivo visual.
- **Passadoria de autor:** Planchado milimétrico de prendas delicadas o lino.
- **Detalhamento de cristais e louças:** Lavado y pulido de vajilla fina y copas.
- **Higienização interna de eletros:** Detalle profundo de interior de heladera y horno.
- **Polimento de metais de luxo:** Tratamiento de griferías premium, bronce o platería.
- **Revitalização de clósets:** Reordenamiento minimalista de percheros y calzado.

---

## 4. Sección de Funcionarias: El Filtro de Confianza

Esta sección está completamente blindada. No muestra precios, paquetes ni comisiones. Está diseñada para repeler perfiles informales y atraer responsabilidad.

### Formulario de Postulación Restrictiva
- **Filtro de Edad Nativo:** El sistema rechaza automáticamente solicitudes si la fecha de nacimiento indica **menos de 30 años**. (Justificación en UI: *O Módulo Pame trabalha exclusivamente com especialistas de alta maturidade operativa corporativa*).
- **Campos Obligatorios:**
  1. Historial de antecedentes verificable (Link o archivo adjunto).
  2. Últimas dos referencias de casas de alto estándar donde prestó servicio en la región.
  3. Declaración de habilidades específicas (Manejo de vaporizadores, cuidado de mármoles).

### Conexión a la Base de Datos Interna
Cada funcionaria aprobada genera una ficha técnica en el sistema con su foto profesional, zonas de Tijucas disponibles y nivel de especialización. El sistema cruza esta disponibilidad con las solicitudes de los clientes de forma automática.

---

## 5. Portal del Cliente: Autogestión Sin Contacto

Diseñado para romper la dependencia de llamadas telefónicas. El cliente tiene el control total de su estatus doméstico desde su celular.

### Integración Técnica de la Cuenta
- **Autenticación:** Login rápido con un clic vía Google Auth (Gmail).
- **Control de Agenda:** Conexión directa a Google Calendar / Calendly API. El cliente puede modificar su horario o reprogramar su sesión con hasta 24 horas de anticipación sin hablar con Pame; el sistema libera el slot en la agenda general y notifica a la funcionaria asignada.
- **Ficha de la Especialista:** El usuario ve la foto de la profesional asignada a su casa, sus calificaciones y sus datos de confianza para eliminar la incertidumbre del ingreso de extraños al hogar.
- **Historial de Faxinas:** Registro contable de servicios realizados, productos específicos utilizados en su casa y observaciones técnicas para la próxima visita.

---

## 6. Disolución de Inseguridades (UI Self-Serving)

Para cumplir la meta de que el sitio responda todo de forma autónoma, la sección de conversión responde a los miedos ocultos del público rico de Tijucas mediante micro-copies estratégicos:

- **Miedo al robo / inseguridad:** *"Todas as nossas especialistas passam por uma auditoria de antecedentes criminais e possuem mais de 30 anos de idade, operando sob um protocolo estrito de integridade regulamentada."*
- **Miedo al daño de superficies caras:** *"Nossa equipe é treinada para identificar a diferença entre mármore de Carrara, quartzito e madeira maciça. Utilizamos insumos específicos para proteger o patrimônio da sua arquitetura."*
- **Miedo a la falta de puntualidad:** *"O Módulo Pame opera integrado via satélite. Se a especialista atrasar mais de 15 minutos por bardo de trânsito, o sistema te avisa no celular e você recebe um crédito automático de detalhamento."*
