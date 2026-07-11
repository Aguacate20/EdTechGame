'use client';

import { useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { Timer } from '@/theme/Timer';

// A3 EVOCAR v1.0.0 — ficha técnica doc 08.
// Dada la definición, el estudiante produce el término.
// Matcheo contra label + sinónimos, tolerancia edit_distance_2.

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[a.length][b.length];
}

type MatchTipo = 'exacto' | 'sinonimo' | 'variante' | 'fallido';

function evaluar(input: string, label: string, sinonimos: string[]): MatchTipo {
  const t = normalizar(input);
  if (!t) return 'fallido';
  const l = normalizar(label);
  if (t === l) return 'exacto';
  if (editDistance(t, l) <= 2) return 'variante';
  for (const s of sinonimos) {
    const ns = normalizar(s);
    if (t === ns || editDistance(t, ns) <= 2) return 'sinonimo';
  }
  return 'fallido';
}

export function A3Evocar({ config, concepts, onComplete }: MechanicProps) {
  const objetivo = concepts[0];
  const maxIntentos = (config.n_intentos_max as number) ?? 2;
  const startRef = useRef(Date.now());
  const [texto, setTexto] = useState('');
  const [intentos, setIntentos] = useState(0);
  const [resultado, setResultado] = useState<MatchTipo | null>(null);
  const [fallidos, setFallidos] = useState<string[]>([]);

  const finalizar = (match: MatchTipo, timeout = false) => {
    const score = match === 'exacto' ? 1 : match === 'fallido' ? 0 : 0.7;
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: match !== 'fallido',
      partial_score: score,
      concepts_involved: [objetivo.concept_id],
      repertoires_activated: [],
      cognitive_signals: [
        {
          dimension: 'recuperacion',
          target: objetivo.concept_id,
          delta: match !== 'fallido' ? 0.08 : -0.06,
          confidence: 0.85,
        },
      ],
      mechanic_specific: {
        texto_ingresado: texto,
        intentos: intentos + 1,
        match_tipo: match,
        tiempo_ms: Date.now() - startRef.current,
        timeout,
      },
    });
  };

  const enviar = () => {
    if (resultado !== null || !texto.trim()) return;
    const match = evaluar(texto, objetivo.label, objetivo.sinonimos);
    const intento = intentos + 1;
    setIntentos(intento);
    if (match !== 'fallido' || intento >= maxIntentos) {
      setResultado(match);
      setTimeout(() => finalizar(match), 1100);
    } else {
      setFallidos((f) => [...f, texto]);
      setTexto('');
    }
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer
          ms={config.tiempo_limite_ms as number}
          paused={resultado !== null}
          onTimeout={() => resultado === null && finalizar('fallido', true)}
        />
      ) : null}
      <p className="mech-prompt">Nombra el concepto que corresponde a:</p>
      <blockquote className="mech-def">{objetivo.definicion_intuitiva}</blockquote>
      <div className="mech-input-row">
        <input
          className="mech-input"
          value={texto}
          disabled={resultado !== null}
          placeholder="Escribe el término…"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          autoFocus
        />
        <button
          className="btn-primary"
          onClick={enviar}
          disabled={resultado !== null || !texto.trim()}
        >
          Invocar
        </button>
      </div>
      {fallidos.length > 0 && resultado === null && (
        <p className="mech-hint">
          ✖ “{fallidos[fallidos.length - 1]}” no es. Te queda{' '}
          {maxIntentos - intentos} intento…
        </p>
      )}
      {resultado !== null && (
        <p className={`mech-verdict ${resultado === 'fallido' ? 'bad' : 'good'}`}>
          {resultado === 'fallido'
            ? `Era: ${objetivo.label}`
            : resultado === 'exacto'
              ? '¡Exacto!'
              : `¡Válido! (${resultado === 'sinonimo' ? 'sinónimo' : 'casi exacto'}: ${objetivo.label})`}
        </p>
      )}
    </div>
  );
}
