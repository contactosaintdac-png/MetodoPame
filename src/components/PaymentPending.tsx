import { motion } from 'motion/react';

interface PaymentPendingProps {
  clientName: string;
  format: string;
  totalPrice: number;
  planMode: string;
  addons: string[];
}

export default function PaymentPending({ clientName, format, totalPrice, planMode, addons }: PaymentPendingProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-6 text-center gap-4 w-full font-sans"
    >
      <div className="w-16 h-16 rounded-full bg-[#f4ebf4] text-[#561668] flex items-center justify-center animate-pulse border border-[#efe5ee] shadow-[inset_2px_2px_6px_#d9cbd9]">
        <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
      </div>
      
      <div>
        <h3 className="text-xl font-extrabold text-[#561668]">Pagamento em processamento...</h3>
        <p className="text-xs text-[#80737f] uppercase tracking-widest font-bold mt-1">
          Pagamento será ativado em breve.
        </p>
        <p className="text-sm text-[#4e434e] mt-2 leading-relaxed max-w-xs mx-auto font-medium">
          Sua solicitação foi registrada com sucesso na nossa curadoria.
        </p>
      </div>

      <div className="bg-[#faf1fa] p-6 rounded-2xl shadow-[inset_3px_3px_8px_#d9cbd9,inset_-3px_-3px_8px_#ffffff] border border-white/60 text-xs text-[#4e434e] max-w-sm w-full leading-relaxed mt-4 text-left relative overflow-hidden">
        {/* Luxury subtle accent line */}
        <div className="absolute top-0 left-0 w-1 h-full bg-[#703081]/40"></div>
        
        <p className="font-extrabold text-[#561668] mb-3 uppercase tracking-widest text-[10px]">Resumo do Pedido</p>
        
        <div className="flex flex-col gap-2.5 ml-2">
          <p className="flex justify-between items-center border-b border-[#d1c2d0]/20 pb-2">
            <span className="opacity-80 font-medium">Cliente</span> 
            <strong className="text-[#1e1a20]">{clientName}</strong>
          </p>
          <p className="flex justify-between items-center border-b border-[#d1c2d0]/20 pb-2">
            <span className="opacity-80 font-medium">Modalidade</span> 
            <strong className="text-[#1e1a20] bg-[#561668]/10 text-[#561668] px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider">{planMode}</strong>
          </p>
          <p className="flex justify-between items-center border-b border-[#d1c2d0]/20 pb-2">
            <span className="opacity-80 font-medium">Turno</span> 
            <strong className="text-[#1e1a20]">{format}</strong>
          </p>
          {addons.length > 0 && (
            <p className="flex justify-between items-start border-b border-[#d1c2d0]/20 pb-2">
              <span className="opacity-80 font-medium whitespace-nowrap">Adicionais</span> 
              <strong className="text-[#1e1a20] text-right ml-4 text-[11px] leading-tight opacity-90">{addons.join(" • ")}</strong>
            </p>
          )}
          <div className="mt-2 flex justify-between items-end">
            <span className="font-bold text-[#561668] uppercase text-[10px] tracking-widest">Total Reservado</span>
            <span className="font-black text-2xl text-[#561668] leading-none">R$ {totalPrice}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
