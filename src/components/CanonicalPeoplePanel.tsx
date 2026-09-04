import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

type Kind = 'candidate' | 'professional';
type RecordValue = Record<string, unknown>;

async function command(user: User, payload: Record<string, unknown>) {
  const token = await user.getIdToken();
  const response = await fetch('/api/people', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? `Erro ${response.status}`);
  return data;
}

function value(source: unknown, path: string): string {
  let current: unknown = source;
  for (const key of path.split('.')) current = current && typeof current === 'object' ? (current as RecordValue)[key] : undefined;
  return typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean' ? String(current) : '—';
}

function humanReason(label: string): string | null {
  const reason = window.prompt(`Registre o motivo para: ${label}`)?.trim() ?? '';
  return reason.length >= 3 ? reason : null;
}

export default function CanonicalPeoplePanel({ user, kind }: { user: User | null; kind: Kind }) {
  const [items, setItems] = useState<RecordValue[]>([]); const [selected, setSelected] = useState<RecordValue | null>(null);
  const [status, setStatus] = useState('Carregando ficha canônica…'); const [running, setRunning] = useState(false);
  const refresh = async () => {
    if (!user) { setStatus('Autenticação necessária.'); return; }
    const result = await command(user, { action: kind === 'candidate' ? 'candidate.list' : 'professional.list' });
    setItems(result.items); setStatus(result.items.length ? '' : `Nenhum cadastro canônico de ${kind === 'candidate' ? 'candidata' : 'profissional'}.`);
  };
  useEffect(() => {
    let active = true;
    refresh().catch((error) => active && setStatus(error instanceof Error ? error.message : 'Falha ao carregar.'));
    return () => { active = false; };
  // `refresh` only uses the authenticated user and panel kind.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, kind]);
  const open = async (id: string) => {
    if (!user) return; setStatus('Abrindo ficha auditada…');
    try { const result = await command(user, { action: 'person.get', kind, id }); setSelected(result.record); setStatus(''); } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao abrir ficha.'); }
  };
  const execute = async (payload: Record<string, unknown>) => {
    if (!user || !selected) return; setRunning(true); setStatus('Registrando decisão humana…');
    try { await command(user, payload); await refresh(); await open(String(selected.id)); } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao registrar.'); } finally { setRunning(false); }
  };
  const candidateAction = (action: string, payload: Record<string, unknown>, label: string, reasonRequired = false) => {
    const reason = reasonRequired ? humanReason(label) : null; if (reasonRequired && !reason) return;
    void execute({ action, applicationId: String(selected?.id), ...payload, ...(reason ? { reason } : {}) });
  };
  const professionalAction = (field: string, nextState: string, label: string) => {
    const reason = humanReason(label); if (!reason) return;
    void execute({ action: 'professional.transition', professionalUid: String(selected?.id), field, nextState, reason });
  };
  const candidateState = value(selected, 'application.state'); const operationState = value(selected, 'professional.lifecycle.operations.state');
  const trainingState = value(selected, 'professional.lifecycle.training.state'); const certificationState = value(selected, 'professional.lifecycle.certification.state');
  return <section className="mb-8 rounded-3xl border border-[#e5d8e4] bg-white/70 p-6">
    <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#80737f]">F0.5 · leitura e comandos auditados</p><h3 className="text-lg font-extrabold text-[#561668]">Ficha canônica {kind === 'candidate' ? 'de candidatas' : 'de profissionais'}</h3></div><span className="rounded-full bg-[#f4ebf4] px-3 py-1 text-[10px] font-bold text-[#561668]">LEGACY PRESERVADO</span></div>
    {status && <p className="text-sm text-[#80737f]">{status}</p>}
    <div className="grid gap-3 md:grid-cols-2">{items.map((item) => <button key={String(item.id)} onClick={() => open(String(item.id))} className="rounded-2xl border border-[#e9e0e8] p-4 text-left hover:bg-[#faf5fa]"><strong className="block text-[#561668]">{value(item, kind === 'candidate' ? 'private.name' : 'profile.displayName')}</strong><span className="text-xs text-[#80737f]">{value(item, kind === 'candidate' ? 'state' : 'lifecycle.operations.state')} · {String(item.id)}</span></button>)}</div>
    {selected && <div className="mt-5 rounded-2xl bg-[#faf7fa] p-4 text-xs"><div className="grid gap-3 md:grid-cols-3">{(kind === 'candidate' ? [['Estado','application.state'],['Café Virtual','application.cafe.state'],['Documentos','application.documents.state'],['Verificações','application.verification.state'],['Decisão humana','application.decision.state'],['Auditoria','audit.length']] : [['Aprovação','professional.lifecycle.approval.state'],['Operação','professional.lifecycle.operations.state'],['Capacitação','professional.lifecycle.training.state'],['Certificação','professional.lifecycle.certification.state'],['Elegível','capacity.eligibleForService'],['Prioridade','capacity.assignmentPriority'],['Auditoria','audit.length']]).map(([label, path]) => <div key={path}><span className="block font-bold uppercase tracking-wider text-[#80737f]">{label}</span><span className="text-[#1e1a20]">{value(selected, path)}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2">
      {kind === 'candidate' && candidateState === 'submitted' && <button disabled={running} onClick={() => candidateAction('candidate.transition', { nextState: 'screening' }, 'iniciar triagem')} className="rounded-lg bg-[#561668] px-3 py-2 font-bold text-white disabled:opacity-50">Iniciar triagem</button>}
      {kind === 'candidate' && candidateState === 'screening' && <button disabled={running} onClick={() => candidateAction('candidate.transition', { nextState: 'under_review' }, 'enviar para revisão')} className="rounded-lg bg-[#561668] px-3 py-2 font-bold text-white disabled:opacity-50">Enviar para revisão</button>}
      {kind === 'candidate' && candidateState === 'under_review' && <><button disabled={running} onClick={() => candidateAction('candidate.review', { cafeState: 'completed' }, 'registrar Café Virtual concluído')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Registrar Café concluído</button><button disabled={running} onClick={() => candidateAction('candidate.review', { documentsVerified: true }, 'confirmar documentos revisados')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Confirmar documentos</button><button disabled={running} onClick={() => candidateAction('candidate.review', { verificationVerified: true }, 'confirmar verificações revisadas')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Confirmar verificações</button><button disabled={running} onClick={() => candidateAction('candidate.decide', { decision: 'approved' }, 'aprovar candidatura', true)} className="rounded-lg bg-[#561668] px-3 py-2 font-bold text-white disabled:opacity-50">Aprovar</button><button disabled={running} onClick={() => candidateAction('candidate.decide', { decision: 'rejected' }, 'rejeitar candidatura', true)} className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">Rejeitar</button></>}
      {kind === 'professional' && operationState === 'inactive' && <button disabled={running} onClick={() => professionalAction('operations', 'active', 'ativar operação')} className="rounded-lg bg-[#561668] px-3 py-2 font-bold text-white disabled:opacity-50">Ativar operação</button>}
      {kind === 'professional' && operationState === 'active' && <button disabled={running} onClick={() => professionalAction('operations', 'suspended', 'suspender operação')} className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">Suspender</button>}
      {kind === 'professional' && operationState === 'suspended' && <button disabled={running} onClick={() => professionalAction('operations', 'active', 'reativar operação')} className="rounded-lg bg-[#561668] px-3 py-2 font-bold text-white disabled:opacity-50">Reativar</button>}
      {kind === 'professional' && trainingState === 'not_started' && <button disabled={running} onClick={() => professionalAction('training', 'in_progress', 'iniciar capacitação')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Iniciar capacitação</button>}
      {kind === 'professional' && trainingState === 'in_progress' && <button disabled={running} onClick={() => professionalAction('training', 'completed', 'concluir capacitação')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Concluir capacitação</button>}
      {kind === 'professional' && certificationState === 'not_certified' && <button disabled={running} onClick={() => professionalAction('certification', 'certified', 'certificar profissional')} className="rounded-lg border border-[#703081] px-3 py-2 font-bold text-[#561668] disabled:opacity-50">Certificar</button>}
      {kind === 'professional' && certificationState === 'certified' && <button disabled={running} onClick={() => professionalAction('certification', 'revoked', 'revogar certificação')} className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">Revogar certificação</button>}
    </div></div>}
  </section>;
}
