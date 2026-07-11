'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MechanicProps } from '@/game-core/types';
import { sample, shuffle } from '@/game-core/rng';
import { Timer } from '@/theme/Timer';
import { Demon, Hero, Slime, SLIME_COLORS } from '@/theme/Sprites';

// E3 APLICAR v1.0.0 — "Combate de hechizos" (arena-nativa).
// EL ENEMIGO ES UN CASO (capa 5): su debilidad es el concepto que lo explica.
// El grimorio son los conceptos del curso. Elegir hechizo = decisión cognitiva
// (alimenta `transferencia`). Después, barra de timing: clavar el centro da
// golpe CRÍTICO (+monedas). Integridad de señal: el crítico modula SOLO la
// recompensa; is_correct lo decide el hechizo elegido, nunca el pulso.

export function E3Aplicar({
  config,
  concepts,
  allConcepts,
  casos,
  rng,
  onComplete,
}: MechanicProps) {
  const objetivo = concepts[0];
  const esBoss = Boolean(config.es_boss);
  const caso = useMemo(() => {
    const propios = casos.filter((k) => k.concepto_correcto === objetivo.concept_id);
    return propios[Math.floor(rng() * propios.length)] ?? casos[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hechizos = useMemo(() => {
    const otros = sample(
      rng,
      allConcepts.filter((c) => c.concept_id !== objetivo.concept_id),
      3
    );
    return shuffle(rng, [objetivo, ...otros]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRef = useRef(Date.now());
  const [elegido, setElegido] = useState<string | null>(null);
  const [fase, setFase] = useState<'eligiendo' | 'timing' | 'resuelto'>('eligiendo');
  const [pos, setPos] = useState(0);
  const [crit, setCrit] = useState(false);
  const [acierto, setAcierto] = useState<boolean | null>(null);
  const posRef = useRef(0);

  // Barra de timing: onda triangular
  useEffect(() => {
    if (fase !== 'timing') return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const t = ((Date.now() - t0) / 900) % 2; // 0..2
      const p = t < 1 ? t * 100 : (2 - t) * 100;
      posRef.current = p;
      setPos(p);
    }, 16);
    return () => clearInterval(id);
  }, [fase]);

  const lanzar = () => {
    const p = posRef.current;
    const esCrit = Math.abs(p - 50) <= 12;
    setCrit(esCrit);
    const correcta = elegido === objetivo.concept_id;
    setAcierto(correcta);
    setFase('resuelto');
    setTimeout(() => finalizar(correcta, esCrit), 1200);
  };

  const finalizar = (correcta: boolean, esCrit: boolean, timeout = false) => {
    onComplete({
      status: timeout ? 'timeout' : 'completed',
      is_correct: timeout ? false : correcta,
      partial_score: !timeout && correcta ? 1 : 0,
      concepts_involved: [objetivo.concept_id],
      repertoires_activated: [],
      cognitive_signals: [
        {
          dimension: 'transferencia',
          target: objetivo.concept_id,
          delta: !timeout && correcta ? 0.08 : -0.06,
          confidence: 0.8,
        },
      ],
      mechanic_specific: {
        variante: 'arena_combate',
        case_id: caso.case_id,
        concepto_elegido: elegido,
        crit: esCrit,
        // Convención capa 1 → capa 2: el crítico es SOLO monedas extra
        bonus_coins: !timeout && correcta && esCrit ? 15 : 0,
        tiempo_ms: Date.now() - startRef.current,
        timeout,
      },
    });
  };

  return (
    <div className="mech">
      {config.tiempo_limite_ms ? (
        <Timer
          ms={config.tiempo_limite_ms as number}
          paused={fase === 'resuelto'}
          onTimeout={() => finalizar(false, false, true)}
        />
      ) : null}

      <div className="combat">
        <div className={`combat-enemy ${fase === 'resuelto' ? (acierto ? 'defeated' : 'attacking') : ''}`}>
          {esBoss ? <Demon px={7} /> : <Slime color={SLIME_COLORS[3]} px={7} />}
          <div className="combat-bubble">{caso.texto}</div>
        </div>
        <div className="combat-vs">
          {fase === 'resuelto' ? (acierto ? (crit ? '💥 ¡CRÍTICO!' : '✦ ¡Efectivo!') : '✖ Sin efecto…') : '⚔'}
        </div>
        <div className="arena-hero combat-hero">
          <Hero px={5} />
        </div>
      </div>

      {fase === 'eligiendo' && (
        <>
          <p className="mech-prompt">📖 ¿Qué concepto explica lo que hace este enemigo?</p>
          <div className="mech-options">
            {hechizos.map((h) => (
              <button
                key={h.concept_id}
                className="opt spell"
                onClick={() => {
                  setElegido(h.concept_id);
                  setFase('timing');
                }}
              >
                ⚡ {h.label}
              </button>
            ))}
          </div>
        </>
      )}

      {fase === 'timing' && (
        <>
          <p className="mech-prompt">¡Clava el centro para golpe crítico!</p>
          <div className="timing-bar">
            <div className="timing-sweet" />
            <div className="timing-marker" style={{ left: `${pos}%` }} />
          </div>
          <button className="btn-primary" onClick={lanzar}>
            ⚡ ¡Lanzar {hechizos.find((h) => h.concept_id === elegido)?.label}!
          </button>
        </>
      )}

      {fase === 'resuelto' && !acierto && (
        <p className="mech-hint">
          Su debilidad era <strong>{objetivo.label}</strong>.
        </p>
      )}
    </div>
  );
}
