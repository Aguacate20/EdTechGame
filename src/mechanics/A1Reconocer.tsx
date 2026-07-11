'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { sample, shuffle } from '@/game-core/rng';
import { Timer } from '@/theme/Timer';

// A1 RECONOCER v1.0.0 — ficha técnica doc 08 §2.
// Elegir el concepto correcto entre N opciones; 1 distractor puede estar
// caracterizado (encarna un repertorio, capa 3). Corrección automática.

interface Opcion {
  label: string;
  concept_id: string | null;
  repertoire_id?: string;
  correcta: boolean;
}

export function A1Reconocer({
  config,
  concepts,
  allConcepts,
  rng,
  lupaDisponible,
  onUseLupa,
  onComplete,
}: MechanicProps) {
  const objetivo = concepts[0];
  const n = (config.n_opciones as number) ?? 4;
  const startRef = useRef(Date.now());
  const [elegida, setElegida] = useState<number | null>(null);
  const [descartadas, setDescartadas] = useState<number[]>([]);
  const [segundaOportunidad, setSegundaOportunidad] = useState(
    Boolean(config.permitir_segunda_oportunidad)
  );

  const opciones = useMemo<Opcion[]>(() => {
    const distractores: Opcion[] = [];
    if (objetivo.distractor_caracterizado) {
      distractores.push({
        label: objetivo.distractor_caracterizado.label,
        concept_id: null,
        repertoire_id: objetivo.distractor_caracterizado.repertoire_id,
        correcta: false,
      });
    }
    const otros = sample(
      rng,
      allConcepts.filter((c) => c.concept_id !== objetivo.concept_id),
      n - 1 - distractores.length
    ).map((c) => ({ label: c.label, concept_id: c.concept_id, correcta: false }));

    return shuffle(rng, [
      { label: objetivo.label, concept_id: objetivo.concept_id, correcta: true },
      ...distractores,
      ...otros,
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizar = (idx: number | null, timeout = false) => {
    const op = idx !== null ? opciones[idx] : null;
    const correcta = Boolean(op?.correcta);
    const repertorio = !correcta && op?.repertoire_id ? [op.repertoire_id] : [];
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: correcta,
      partial_score: correcta ? 1 : 0,
      concepts_involved: [objetivo.concept_id],
      repertoires_activated: repertorio,
      cognitive_signals: [
        {
          dimension: 'recuperacion',
          target: objetivo.concept_id,
          delta: correcta ? 0.05 : -0.05,
          confidence: 0.8,
        },
        ...repertorio.map((r) => ({
          dimension: 'anclaje' as const,
          target: r,
          delta: 0.1,
          confidence: 0.9,
        })),
      ],
      mechanic_specific: {
        opcion_elegida_concept_id: op?.concept_id ?? null,
        posicion_en_set: idx,
        distractor_caracterizado_presente: Boolean(
          objetivo.distractor_caracterizado
        ),
        timeout,
      },
    });
  };

  const elegir = (idx: number) => {
    if (elegida !== null || descartadas.includes(idx)) return;
    const op = opciones[idx];
    // Amuleto: segunda oportunidad automática (mutación de parámetro, doc 09 §3)
    if (!op.correcta && segundaOportunidad) {
      setSegundaOportunidad(false);
      setDescartadas((d) => [...d, idx]);
      return;
    }
    setElegida(idx);
    setTimeout(() => finalizar(idx), 900);
  };

  const usarLupa = () => {
    // Regla doc 09 §3: la lupa NUNCA descarta el distractor caracterizado.
    const candidatos = opciones
      .map((o, i) => ({ o, i }))
      .filter(
        ({ o, i }) =>
          !o.correcta && !o.repertoire_id && !descartadas.includes(i)
      );
    if (!candidatos.length) return;
    setDescartadas((d) => [...d, candidatos[0].i]);
    onUseLupa?.();
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer
          ms={config.tiempo_limite_ms as number}
          paused={elegida !== null}
          onTimeout={() => elegida === null && finalizar(null, true)}
        />
      ) : null}
      <p className="mech-prompt">¿Qué concepto corresponde a esta definición?</p>
      <blockquote className="mech-def">{objetivo.definicion_formal}</blockquote>
      <div className="mech-options">
        {opciones.map((op, i) => {
          const revelada = elegida !== null;
          const estado = descartadas.includes(i)
            ? 'descartada'
            : revelada && op.correcta
              ? 'correcta'
              : revelada && i === elegida
                ? 'incorrecta'
                : '';
          return (
            <button
              key={i}
              className={`opt ${estado}`}
              disabled={revelada || descartadas.includes(i)}
              onClick={() => elegir(i)}
            >
              {op.label}
              {revelada && i === elegida && op.repertoire_id && (
                <span className="opt-note">
                  ⚠ intuición detectada: “
                  {objetivo.distractor_caracterizado?.label}”
                </span>
              )}
            </button>
          );
        })}
      </div>
      {lupaDisponible && elegida === null && (
        <button className="item-btn" onClick={usarLupa}>
          🔍 Usar Lupa (descarta una opción)
        </button>
      )}
      {!segundaOportunidad && config.permitir_segunda_oportunidad ? (
        <p className="mech-hint">🧿 El amuleto absorbió un fallo…</p>
      ) : null}
    </div>
  );
}
