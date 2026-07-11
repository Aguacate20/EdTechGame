'use client';

import { useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { Timer } from '@/theme/Timer';

// A2 COMPLETAR v1.0.0 — ficha técnica doc 08.
// Rellenar el blank en un fragmento del corpus. Permisividad 'sinonimo':
// acepta label, sinónimos y typos leves (edit distance ≤ 2).

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
}
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function A2Completar({ config, concepts, onComplete }: MechanicProps) {
  const objetivo = concepts[0];
  const fragmento = objetivo.fragmento ?? `${objetivo.definicion_intuitiva} → ____`;
  const maxIntentos = (config.n_intentos_max as number) ?? 2;
  const startRef = useRef(Date.now());
  const [texto, setTexto] = useState('');
  const [intentos, setIntentos] = useState(0);
  const [resultado, setResultado] = useState<'ok' | 'sin' | 'fail' | null>(null);

  const evaluar = (input: string): 'ok' | 'sin' | 'fail' => {
    const t = normalizar(input);
    if (!t) return 'fail';
    if (t === normalizar(objetivo.label) || editDistance(t, normalizar(objetivo.label)) <= 2) return 'ok';
    for (const s of objetivo.sinonimos) {
      const ns = normalizar(s);
      if (t === ns || editDistance(t, ns) <= 2) return 'sin';
    }
    return 'fail';
  };

  const finalizar = (r: 'ok' | 'sin' | 'fail', timeout = false) => {
    const score = r === 'ok' ? 1 : r === 'sin' ? 0.7 : 0;
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: r !== 'fail',
      partial_score: score,
      concepts_involved: [objetivo.concept_id],
      repertoires_activated: [],
      cognitive_signals: [
        { dimension: 'recuperacion', target: objetivo.concept_id, delta: r !== 'fail' ? 0.06 : -0.05, confidence: 0.8 },
      ],
      mechanic_specific: {
        blanks: [{ posicion: 0, texto_ingresado: texto, modo_aceptacion: r === 'ok' ? 'exact_match' : r === 'sin' ? 'sinonimo' : 'fallido' }],
        intentos: intentos + 1,
        tiempo_ms: Date.now() - startRef.current,
        timeout,
      },
    });
  };

  const enviar = () => {
    if (resultado !== null || !texto.trim()) return;
    const r = evaluar(texto);
    const intento = intentos + 1;
    setIntentos(intento);
    if (r !== 'fail' || intento >= maxIntentos) {
      setResultado(r);
      setTimeout(() => finalizar(r), 1100);
    } else {
      setTexto('');
    }
  };

  const [antes, despues] = fragmento.split('____');

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer ms={config.tiempo_limite_ms as number} paused={resultado !== null}
          onTimeout={() => resultado === null && finalizar('fail', true)} />
      ) : null}
      <p className="mech-prompt">📜 El pergamino está incompleto. Restaura la palabra perdida:</p>
      <blockquote className="mech-def frag">
        {antes}
        <input
          className="frag-blank"
          value={texto}
          disabled={resultado !== null}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          size={Math.max(12, texto.length)}
          autoFocus
        />
        {despues}
      </blockquote>
      <button className="btn-primary" onClick={enviar} disabled={resultado !== null || !texto.trim()}>
        Restaurar
      </button>
      {intentos > 0 && resultado === null && (
        <p className="mech-hint">✖ No encaja. Te queda {maxIntentos - intentos} intento…</p>
      )}
      {resultado !== null && (
        <p className={`mech-verdict ${resultado === 'fail' ? 'bad' : 'good'}`}>
          {resultado === 'fail' ? `Era: ${objetivo.label}` : resultado === 'ok' ? '¡Restaurado!' : `¡Válido! (era: ${objetivo.label})`}
        </p>
      )}
    </div>
  );
}
