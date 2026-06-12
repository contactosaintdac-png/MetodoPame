import { motion } from 'motion/react';
import { ApplicationScreen } from '../types';

interface NotFoundProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function NotFound({ onScreenChange }: NotFoundProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fff7fd] px-6 py-12 relative overflow-hidden font-sans">
      
      {/* Decorative luxury abstract circles */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#fceeff] opacity-40 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#fae5ff] opacity-40 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="silk-lift rounded-3xl p-8 md:p-12 max-w-lg w-full text-center relative border border-[#efe5ee]/40 flex flex-col items-center gap-6"
      >
        {/* Elegant top icon inside neumorphic ring */}
        <div className="w-16 h-16 rounded-full bg-[#fdf2fc] border border-[#f5e4f5] flex items-center justify-center shadow-sm text-[#561668] mb-2">
          <span className="material-symbols-outlined text-[32px] font-light animate-pulse-silk">explore_off</span>
        </div>

        <div>
          <span className="text-[10px] font-extrabold text-[#561668] tracking-[0.2em] uppercase">Erro 404</span>
          <h2 className="font-display italic text-3xl md:text-4xl text-[#561668] mt-2 font-medium">
            Caminho Inexistente
          </h2>
          <div className="w-8 h-[2px] bg-[#703081] mx-auto mt-4 mb-4" />
          <p className="text-sm text-[#80737f] leading-relaxed max-w-sm mx-auto font-normal">
            A sofisticação está em cada detalhe. No entanto, a página que você está tentando acessar não existe ou foi movida.
          </p>
        </div>

        <button
          onClick={() => onScreenChange('welcome')}
          className="active-scale mt-2 w-full py-3.5 bg-[#561668] hover:bg-[#703081] text-white font-bold tracking-widest text-xs uppercase rounded-xl shadow-md transition-all cursor-pointer font-sans"
        >
          Voltar ao Início
        </button>
      </motion.div>
    </div>
  );
}
