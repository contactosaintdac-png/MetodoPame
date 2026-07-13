import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Document, Page, Text, View, StyleSheet, Font, PDFDownloadLink } from '@react-pdf/renderer';
import { Employee } from '../types';

// Register Manrope font from stable public URLs
Font.register({
  family: 'Manrope',
  fonts: [
    { src: 'https://raw.githubusercontent.com/jpt/manrope-font/master/fonts/webfonts/Manrope-Regular.ttf' },
    { src: 'https://raw.githubusercontent.com/jpt/manrope-font/master/fonts/webfonts/Manrope-Bold.ttf', fontWeight: 700 }
  ]
});

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#561668',
    color: '#FFFFFF',
    fontFamily: 'Manrope',
    padding: 40,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    border: '8pt solid #C9A84C',
  },
  innerBorder: {
    border: '1pt solid rgba(201, 168, 76, 0.3)',
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    marginTop: 10,
  },
  logoSubtitle: {
    fontSize: 9,
    letterSpacing: 4,
    color: '#C9A84C',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#FFFFFF',
    marginTop: 15,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  bodyBlock: {
    alignItems: 'center',
    marginVertical: 20,
    maxWidth: 550,
  },
  certText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 1.8,
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    color: '#C9A84C',
    marginVertical: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  footerBlock: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTop: '1pt solid rgba(255, 255, 255, 0.1)',
    paddingTop: 20,
  },
  footerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  footerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 7,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 700,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#C9A84C',
  },
  signatureTitle: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
  }
});

// PDF Document Component
interface PDFDocumentProps {
  employeeName: string;
  score: number;
  dateStr: string;
  code: string;
  level: string;
}

const CertificateDocument = ({ employeeName, score, dateStr, code, level }: PDFDocumentProps) => (
  <Document title={`Certificado Método Pame - ${employeeName}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.innerBorder}>
        {/* Header logo & title */}
        <View style={styles.headerBlock}>
          <Text style={styles.logoSubtitle}>Método Pame | Home Detail</Text>
          <Text style={styles.mainTitle}>Certificado de Formação</Text>
          <Text style={styles.subtitle}>Conclusão de Capacitação Técnica</Text>
        </View>

        {/* Certificate central text */}
        <View style={styles.bodyBlock}>
          <Text style={styles.certText}>
            Certificamos que para todos os efeitos de capacitação técnica de alto padrão e postura profissional residencial,
          </Text>
          <Text style={styles.name}>{employeeName}</Text>
          <Text style={styles.certText}>
            completou o curso completo do Método Pame, obtendo o aproveitamento de{' '}
            <Text style={styles.scoreText}>{score}%</Text> no exame de certificação final, estando habilitada e autorizada a atuar com o nível de{' '}
            <Text style={styles.scoreText}>{level}</Text>.
          </Text>
        </View>

        {/* Footer meta metadata & Pame signature */}
        <View style={styles.footerBlock}>
          <View style={styles.footerLeft}>
            <Text style={styles.metaLabel}>Código de Verificação</Text>
            <Text style={styles.metaValue}>{code}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Emitido em</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
          </View>

          <View style={styles.footerRight}>
            <Text style={styles.signatureName}>PAMEELA MAIOLI</Text>
            <Text style={styles.signatureTitle}>Fundadora & Diretora, Método Pame</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Validação Pública</Text>
            <Text style={[styles.metaValue, { fontSize: 7, color: 'rgba(255,255,255,0.7)' }]}>
              metodopame.com/verificar-certificado/{code}
            </Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

// React View wrapper
interface LMSCertificateProps {
  employee: Employee;
  onNavigate: (view: 'overview') => void;
}

export default function LMSCertificate({ employee, onNavigate }: LMSCertificateProps) {
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<any>(null);

  useEffect(() => {
    async function loadCertInfo() {
      if (!employee.id) return;
      try {
        setLoading(true);
        // Look up employee record directly from db to ensure fresh values
        const docSnap = await getDoc(doc(db, 'employees', employee.id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.certificationCode) {
            const date = data.certificationDate?.toDate ? data.certificationDate.toDate() : new Date();
            const dateStr = date.toLocaleDateString('pt-BR');
            setCertData({
              employeeName: data.name,
              score: data.finalExamScore || 0,
              dateStr,
              code: data.certificationCode,
              level: data.certificationLevel || 'Certificada Método Pame'
            });
          }
        }
      } catch (err) {
        console.error('Error loading certificate:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCertInfo();
  }, [employee]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[#80737f] font-bold uppercase tracking-wider">Gerando certificado...</p>
      </div>
    );
  }

  if (!certData) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-md">
        <span className="material-symbols-outlined text-[48px] text-[#ba1a1a] mb-4">error</span>
        <h3 className="font-bold text-[#561668] text-lg">Certificado não encontrado</h3>
        <p className="text-xs text-[#80737f] mt-1.5">
          Você precisa completar todas as 15 avaliações dos módulos e ser aprovada no exame final para gerar seu certificado.
        </p>
        <button 
          onClick={() => onNavigate('overview')}
          className="mt-6 bg-[#561668] hover:bg-[#431051] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm"
        >
          Voltar ao Portal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back button */}
      <button 
        onClick={() => onNavigate('overview')}
        className="flex items-center gap-2 text-xs font-bold text-[#80737f] hover:text-[#561668] transition-all mb-6 uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Voltar à Visão Geral
      </button>

      {/* Screen Title */}
      <div className="text-center mb-8">
        <span className="bg-[#C9A84C]/15 text-[#C9A84C] text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-[#C9A84C]/10">
          Documento Oficial
        </span>
        <h1 className="text-2xl font-bold text-[#561668] mt-3">Seu Certificado Concluído</h1>
        <p className="text-xs text-[#80737f] mt-1">Disponível para download em PDF de alta resolução.</p>
      </div>

      {/* Premium Web Mockup Preview */}
      <div className="bg-[#561668] border-8 border-[#C9A84C] p-8 rounded-3xl shadow-xl aspect-[1.414] flex flex-col justify-between items-center text-white relative overflow-hidden mb-8 font-sans">
        {/* Decorative corner lines */}
        <div className="absolute inset-4 border border-[#C9A84C]/20 rounded-xl flex flex-col justify-between items-center p-6 pointer-events-none"></div>
        
        {/* Top Header */}
        <div className="text-center mt-2 relative z-10">
          <div className="text-[8px] uppercase tracking-[4px] text-[#C9A84C] font-bold">Método Pame | Home Detail</div>
          <div className="text-xl font-display italic font-semibold mt-3 text-white uppercase tracking-wider">Certificado de Formação</div>
          <div className="text-[9px] uppercase tracking-wider text-white/60 mt-1">Conclusão de Capacitação Técnica</div>
        </div>

        {/* Central Certification Text */}
        <div className="text-center max-w-md my-4 relative z-10">
          <div className="text-[10px] text-white/80 leading-relaxed font-light">
            Certificamos que para todos os efeitos de capacitação técnica de alto padrão e postura profissional residencial,
          </div>
          <div className="text-xl font-bold text-[#C9A84C] my-3 uppercase tracking-wider">{certData.employeeName}</div>
          <div className="text-[10px] text-white/80 leading-relaxed font-light">
            completou o curso completo do Método Pame, obtendo o aproveitamento de <span className="font-bold text-white">{certData.score}%</span> no exame de certificação final, estando habilitada e autorizada a atuar com o nível de <span className="font-bold text-white">{certData.level}</span>.
          </div>
        </div>

        {/* Footer Metadata */}
        <div className="w-full flex justify-between items-end border-t border-white/10 pt-4 relative z-10">
          <div className="text-left">
            <div className="text-[6px] text-white/40 uppercase tracking-widest">Código de Verificação</div>
            <div className="text-[8px] font-bold font-mono text-white/90">{certData.code}</div>
            <div className="text-[6px] text-white/40 uppercase tracking-widest mt-2">Emitido em</div>
            <div className="text-[8px] font-bold text-white/90">{certData.dateStr}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold text-[#C9A84C]">PAMEELA MAIOLI</div>
            <div className="text-[7px] text-white/60">Fundadora & Diretora, Método Pame</div>
            <div className="text-[6px] text-white/40 uppercase tracking-widest mt-2">Validação Pública</div>
            <div className="text-[6px] text-white/70">metodopame.com/verificar-certificado/{certData.code}</div>
          </div>
        </div>
      </div>

      {/* Download Action */}
      <div className="flex justify-center">
        <PDFDownloadLink
          document={
            <CertificateDocument
              employeeName={certData.employeeName}
              score={certData.score}
              dateStr={certData.dateStr}
              code={certData.code}
              level={certData.level}
            />
          }
          fileName={`certificado_metodopame_${certData.employeeName.toLowerCase().replace(/\s+/g, '_')}.pdf`}
          className="bg-[#C9A84C] hover:bg-[#b0913e] text-white px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all silk-lift-md flex items-center gap-2"
        >
          {({ loading: pdfLoading }) => (
            <>
              <span className="material-symbols-outlined text-[20px]">download</span>
              {pdfLoading ? 'Gerando PDF...' : 'Baixar Certificado em PDF'}
            </>
          )}
        </PDFDownloadLink>
      </div>
    </div>
  );
}
