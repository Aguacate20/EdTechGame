'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type FC } from 'react';
import type {
  Concept,
  MechanicOutput,
  MechanicProps,
  MechanicResult,
} from '@/game-core/types';
import {
  currentFloor,
  dungeonReducer,
  generateDungeon,
  hasItem,
  multiplier,
  roomById,
  type DRoom,
  type DungeonConfig,
  type DungeonState,
} from '@/game-core/dungeon';
import { byId, PRIMARIAS_JUGABLES } from '@/game-core/registry';
import { ITEM_CATALOG } from '@/game-core/items';
import { WEAPONS } from '@/game-core/weapons';
import { scaffoldFor } from '@/game-core/scaffold';
import { mulberry32, sample, shuffle, uuid } from '@/game-core/rng';
import { LocalEventSink } from '@/game-core/eventLog';
import { CURSO_DEMO } from '@/data/materiaPrima';
import { A1Reconocer } from '@/mechanics/A1Reconocer';
import { A2Completar } from '@/mechanics/A2Completar';
import { A3Evocar } from '@/mechanics/A3Evocar';
import { B1Distinguir } from '@/mechanics/B1Distinguir';
import { B2Clasificar } from '@/mechanics/B2Clasificar';
import { C1Conectar } from '@/mechanics/C1Conectar';
import { E3Aplicar } from '@/mechanics/E3Aplicar';
import { G1Apostar, type NivelConfianza } from '@/mechanics/G1Apostar';
import { G4Autopsia } from '@/mechanics/G4Autopsia';
import { RoomStage, type Dir } from './RoomStage';
import { Minimap } from './Minimap';

// ============================================================
// Crawler — orquestador de la expedición (v0.3).
// El RoomStage corre el tiempo real; aquí viven el estado meta
// (corazones, monedas, pisos), los overlays de las piezas que se
// juegan como interfaz (puertas, santuarios, altares, puentes,
// tratos, fogatas, autopsias) y la emisión de MechanicOutput.
// ============================================================

const CARDS: Record<string, FC<MechanicProps>> = {
  A1: A1Reconocer,
  A2: A2Completar,
  A3: A3Evocar,
  B1: B1Distinguir,
  B2: B2Clasificar,
  C1: C1Conectar,
  E3: E3Aplicar,
};
const PROP_PIECE: Record<string, string> = {
  door: 'A2',
  shrine: 'A3',
  altar: 'B2',
  bridge: 'C1',
};
const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

type Overlay =
  | { kind: 'contract' } // G2 · contrato de piso
  | { kind: 'minigame'; piece: string }
  | { kind: 'campfire' }
  | { kind: 'deal' }
  | { kind: 'scope' } // G3 · mirilla del explorador
  | { kind: 'gauntlet'; piece: string; total: number }
  | { kind: 'autopsy'; conceptLabel: string }
  | { kind: 'curation' } // I5 · curaduría del mazo (portal)
  | { kind: 'route' } // I1 · ruta del explorador (portal)
  | { kind: 'spyglass' } // I2 · catalejo
  | { kind: 'archivo' } // modo aprendizaje: la biblioteca del piso
  | null;

export function Crawler({ config }: { config: DungeonConfig }) {
  const materia = CURSO_DEMO;
  const [state, dispatch] = useReducer(
    dungeonReducer,
    undefined,
    () => generateDungeon(materia, config) as DungeonState
  );
  const sink = useMemo(() => new LocalEventSink(state.run_id), [state.run_id]);
  const stepRef = useRef(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [entryDir, setEntryDir] = useState<Dir | null>(null);
  const [gauntletHp, setGauntletHp] = useState(0);
  const [toast, setToast] = useState('');
  const errorsInRoom = useRef<string | null>(null); // último concepto fallado en la sala
  const lastErrorMeta = useRef<{ latencia: number } | null>(null);
  const tally = useRef(new Map<string, { ok: number; total: number }>()); // desempeño real por concepto
  const lastCorrect = useRef<string | null>(null); // J5 · combo semántico
  const offeredContract = useRef(new Set<number>()); // G2 · un contrato por piso
  const rated = useRef(new Map<string, { tasa: 'facil' | 'parejo' | 'dificil'; realHard: boolean }>()); // G3
  const evidence = useRef({ errLow: 0, errHigh: 0, dmg: 0, betLost: 0, rapidos: 0 }); // G4 campamento
  const pendingCuration = useRef(false);
  const has = (p: string) => config.pieces.includes(p);

  const floor = currentFloor(state);
  const room = roomById(state, state.current_room);
  const modo = config.modo ?? 'evaluacion';
  const erroresPiso = useRef(0);
  const [rescaffold, setRescaffold] = useState(false);
  const scaffold = scaffoldFor(modo, state.floor_index);
  // Re-scaffold (doc 01 §6): si los errores suben donde el andamio ya se
  // retiró, el andamio regresa para este piso — y se anuncia.
  useEffect(() => {
    erroresPiso.current = 0;
    setRescaffold(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.floor_index]);

  // ---------- Emisión de MechanicOutput ----------
  const emit = (mechanicId: string, result: MechanicResult, extra: Record<string, unknown> = {}) => {
    const now = new Date().toISOString();
    const output: MechanicOutput = {
      mechanic_id: mechanicId,
      mechanic_version: '1.0.0',
      instance_id: uuid(mulberry32(state.seed + stepRef.current * 31)),
      composition_id: state.run_id,
      step_index: stepRef.current++,
      student_id: 'anon',
      session_id: state.run_id,
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      relations_involved: [],
      cases_involved: [],
      ...result,
      mechanic_specific: {
        ...result.mechanic_specific,
        ...extra,
        floor: state.floor_index,
        room: room.id,
        room_type: room.type,
      },
    };
    void sink.emit(output);
  };

  // Evento cognitivo desde el stage o un overlay
  const onCog = (mechanicId: string, result: MechanicResult, reward = 10) => {
    emit(mechanicId, result);
    const ok = result.is_correct === true || (result.is_correct === null && result.partial_score >= 0.5);
    for (const cid of result.concepts_involved) {
      const e = tally.current.get(cid) ?? { ok: 0, total: 0 };
      e.total += 1;
      if (ok) e.ok += 1;
      tally.current.set(cid, e);
    }
    if (!ok) {
      const c = materia.concepts.find((x) => x.concept_id === result.concepts_involved[0]);
      errorsInRoom.current = c?.label ?? result.concepts_involved[0] ?? null;
      const lat = Number(result.mechanic_specific?.latencia_ms ?? 0);
      lastErrorMeta.current = { latencia: lat };
      // Evidencia para el campamento post-muerte (G4)
      const pres = Number(result.mechanic_specific?.presion ?? 0);
      if (pres >= 2) evidence.current.errHigh += 1;
      else evidence.current.errLow += 1;
      if (lat > 0 && lat < 2500) evidence.current.rapidos += 1;
      lastCorrect.current = null;
      // Eco de anclaje: si el error activó un repertorio, el concepto volverá.
      // En modo aprendizaje TODO error se re-encola (práctica espaciada).
      if ((result.repertoires_activated.length || modo === 'aprendizaje') && result.concepts_involved[0]) {
        dispatch({ type: 'ADD_ECO', concept_id: result.concepts_involved[0] });
      }
      erroresPiso.current += 1;
      if (modo === 'aprendizaje' && scaffold.hint_tras_errores === null && erroresPiso.current >= 3 && !rescaffold) {
        setRescaffold(true);
        setToast('🪜 El andamio regresa: el archivo notó que este piso te está costando.');
        setTimeout(() => setToast(''), 2600);
      }
    }
    // El eco se consumió (reapareció en una cacería y fue resuelto)
    const eco = result.mechanic_specific?.eco_de_anclaje;
    if (typeof eco === 'string' && eco) dispatch({ type: 'CONSUME_ECO', concept_id: eco });

    // I5 · Conceptos que decidiste llevar pagan más botín
    let r = Math.round(reward * result.partial_score);
    if (ok && result.concepts_involved.some((c) => state.carried.includes(c))) r = Math.round(r * 1.5);

    // J5 · Combo semántico: aciertos consecutivos RELACIONADOS en el grafo
    // multiplican más que la racha bruta (jugar el grafo, no la velocidad)
    if (ok && result.concepts_involved[0]) {
      const cur = result.concepts_involved[0];
      const prev = lastCorrect.current;
      if (
        prev && prev !== cur &&
        materia.relaciones.some(
          (rel) => (rel.origen === prev && rel.destino === cur) || (rel.origen === cur && rel.destino === prev)
        )
      ) {
        r = Math.round(r * 1.5);
        setToast('🧵 ¡Combo semántico! Conceptos hilados: botín ×1.5');
        setTimeout(() => setToast(''), 1500);
        emit('J5', {
          status: 'completed', is_correct: null, partial_score: 1,
          concepts_involved: [prev, cur], repertoires_activated: [],
          cognitive_signals: [{ dimension: 'relacion', target: `${prev}→${cur}`, delta: 0.02, confidence: 0.5 }],
          mechanic_specific: { variante: 'combo_semantico', implicita: true },
        });
      }
      lastCorrect.current = cur;
    }
    dispatch({ type: 'COG', correct: ok, reward: r });
  };

  const onDamage = () => {
    evidence.current.dmg += 1;
    if (state.bet > 0 && !state.bet_lost) evidence.current.betLost += 1;
    if (hasItem(state, 'amuleto')) {
      dispatch({ type: 'USE_ITEM', item_id: 'amuleto' });
      setToast('🧿 El amuleto absorbió el golpe');
      setTimeout(() => setToast(''), 1400);
      return;
    }
    dispatch({ type: 'DAMAGE' });
  };

  const onCleared = (bonus: number) => {
    dispatch({ type: 'CLEAR_ROOM', room_id: room.id });
    if (bonus) dispatch({ type: 'GAIN', coins: bonus });
    // G3 · La tasación fijó la recompensa ANTES del intento
    const rate = rated.current.get(room.id);
    if (rate && (room.type === 'elite' || room.type === 'boss')) {
      const pay =
        rate.tasa === 'dificil' ? (rate.realHard ? 30 : 5) : rate.tasa === 'parejo' ? 15 : 10;
      dispatch({ type: 'GAIN', coins: pay });
      setToast(
        rate.tasa === 'dificil' && !rate.realHard
          ? `🌡 Lo tasaste difícil, pero tu historial decía otra cosa: +${pay} 🪙`
          : `🌡 Tasación ${rate.realHard === (rate.tasa === 'dificil') ? 'certera' : 'hecha'}: +${pay} 🪙`
      );
      setTimeout(() => setToast(''), 2000);
    }
    // G4: autopsia si hubo error cognitivo en la sala (máx 1 por piso)
    if (has('G4') && errorsInRoom.current && state.autopsy_done_floor < state.floor_index) {
      setOverlay({ kind: 'autopsy', conceptLabel: errorsInRoom.current });
    }
    errorsInRoom.current = null;
  };

  // ---------- Entrada a salas: tratos y guanteletes ----------
  useEffect(() => {
    if (state.status !== 'active' || overlay) return;
    const isFinal = room.type === 'elite' || room.type === 'boss';
    if (isFinal && !room.cleared) {
      if (has('G3') && !rated.current.has(room.id)) {
        setOverlay({ kind: 'scope' });
        return;
      }
      if (has('G1') && state.bet === 0 && !state.bet_lost) {
        setOverlay({ kind: 'deal' });
        return;
      }
      if (!has('E3')) {
        // Guantelete: la pieza primaria más exigente seleccionada, en rondas
        const primarias = PRIMARIAS_JUGABLES.filter((m) => has(m.id)).sort(
          (a, b) => b.rank - a.rank
        );
        const piece = primarias[0]?.id ?? 'A1';
        const total = room.type === 'boss' ? 3 : 2;
        setGauntletHp(total);
        setOverlay({ kind: 'gauntlet', piece, total });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current_room, room.cleared, state.bet, overlay, state.status]);

  // G2 · Contrato al pisar la primera sala de cada piso
  useEffect(() => {
    if (state.status !== 'active' || overlay || !has('G2')) return;
    const first = floor.rooms[0];
    if (room.id === first.id && !offeredContract.current.has(state.floor_index)) {
      offeredContract.current.add(state.floor_index);
      setOverlay({ kind: 'contract' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.floor_index, state.current_room, state.status]);

  // Guardián anti-desplazamiento v2 + diagnóstico en pantalla.
  // (1) Revierte scroll horizontal en CUALQUIER elemento de la página.
  // (2) Detecta corrimientos de LAYOUT (el juego dibujado fuera del
  //     viewport) e identifica al descendiente ancho culpable.
  // Si algo se mueve, aparece una insignia roja con el diagnóstico exacto.
  const [diag, setDiag] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const report = (msg: string) => {
      console.warn('[La Expedición · diagnóstico]', msg);
      setDiag(msg);
    };
    const fix = () => {
      document.querySelectorAll('*').forEach((n) => {
        const el = n as HTMLElement;
        if (el.scrollLeft && Math.abs(el.scrollLeft) > 1) {
          report(`scroll horizontal en <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 60)}"> = ${Math.round(el.scrollLeft)}px (revertido)`);
          el.scrollLeft = 0;
        }
      });
      const g = document.querySelector('.game') as HTMLElement | null;
      if (g) {
        const r = g.getBoundingClientRect();
        if (r.left < -12 || r.right > window.innerWidth + 12) {
          let culpable: HTMLElement | null = null;
          let w = g.clientWidth + 20;
          g.querySelectorAll('*').forEach((n) => {
            const el = n as HTMLElement;
            if (el.offsetWidth > w) { w = el.offsetWidth; culpable = el; }
          });
          const c = culpable as HTMLElement | null;
          report(
            `LAYOUT corrido: .game left=${Math.round(r.left)}px, ancho=${Math.round(r.width)}px, viewport=${window.innerWidth}px` +
            (c ? ` · culpable: <${c.tagName.toLowerCase()} class="${String(c.className).slice(0, 60)}"> ancho=${w}px` : ' · sin descendiente ancho detectado')
          );
        }
      }
    };
    window.addEventListener('scroll', fix, true);
    const id = window.setInterval(fix, 400);
    fix();
    return () => {
      window.removeEventListener('scroll', fix, true);
      window.clearInterval(id);
    };
  }, []);

  // Bendición del campamento (G4): un regalo de la muerte anterior
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('expedicion_bendicion');
      if (!raw) return;
      localStorage.removeItem('expedicion_bendicion');
      const { vs } = JSON.parse(raw) as { vs: string };
      const regalo: Record<string, () => void> = {
        concepto: () => dispatch({ type: 'PICK_ITEM', item_id: 'lupa' }),
        presion: () => dispatch({ type: 'PICK_ITEM', item_id: 'amuleto' }),
        prisa: () => dispatch({ type: 'PICK_ITEM', item_id: 'botas' }),
        apuesta: () => dispatch({ type: 'GAIN', coins: 25 }),
      };
      (regalo[vs] ?? regalo.apuesta)();
      setToast(`🕯 Bendición del campamento: el ritual contra "${vs}" te acompaña.`);
      setTimeout(() => setToast(''), 2600);
    } catch { /* sin bendición */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'won' || state.status === 'game_over') {
    return (
      <Summary
        state={state}
        materia={materia}
        emit={emit}
        cartografo={has('G5')}
        deathcamp={has('G4') && state.status === 'game_over'}
        evidence={evidence.current}
      />
    );
  }

  // ---------- Materia prima para overlays ----------
  const overlayConcepts = (): Concept[] =>
    room.concept_ids
      .map((id) => materia.concepts.find((c) => c.concept_id === id))
      .filter((c): c is Concept => Boolean(c));
  const rngOverlay = mulberry32(state.seed + stepRef.current * 977 + state.floor_index);

  const freshConceptsFor = (piece: string): Concept[] => {
    const meta = byId(piece);
    if (piece === 'C1') {
      const r = materia.relaciones[Math.floor(rngOverlay() * materia.relaciones.length)];
      return [r.origen, r.destino]
        .map((id) => materia.concepts.find((c) => c.concept_id === id))
        .filter((c): c is Concept => Boolean(c));
    }
    const pool =
      piece === 'E3' || piece === 'B2'
        ? materia.concepts.filter((c) => materia.casos.some((k) => k.concepto_correcto === c.concept_id))
        : piece === 'A2'
          ? materia.concepts.filter((c) => c.fragmento)
          : materia.concepts;
    void meta;
    return sample(rngOverlay, pool, 1);
  };

  // ---------- Render de overlays ----------
  const renderOverlay = () => {
    if (!overlay) return null;

    if (overlay.kind === 'contract') {
      return (
        <div className="mech">
          <p className="mech-prompt">📜 Contrato del piso {state.floor_index + 1}</p>
          <p className="mech-def">
            Declara tu palabra de explorador: ¿qué fracción de tus decisiones
            cognitivas acertarás en este piso? El cierre lo revelará — cumplir paga.
          </p>
          <div className="mech-options">
            {[
              { t: 0.9, label: '⚔ 9 de cada 10 (+45 🪙 si cumples)' },
              { t: 0.7, label: '🛡 7 de cada 10 (+25 🪙)' },
              { t: 0.5, label: '🌱 La mitad (+10 🪙)' },
            ].map(({ t, label }) => (
              <button key={t} className="opt" onClick={() => {
                dispatch({ type: 'SET_CONTRACT', target: t });
                emit('G2', {
                  status: 'completed', is_correct: null, partial_score: 1,
                  concepts_involved: [], repertoires_activated: [],
                  cognitive_signals: [{ dimension: 'srl_planeacion', target: `piso_${state.floor_index}`, delta: 0, confidence: 0.7 }],
                  mechanic_specific: { variante: 'contrato_de_piso', objetivo: t, piso: state.floor_index },
                });
                setOverlay(null);
              }}>{label}</button>
            ))}
            <button className="opt" onClick={() => setOverlay(null)}>Sin contrato esta vez</button>
          </div>
        </div>
      );
    }

    if (overlay.kind === 'scope') {
      // G3 · La tasación se coteja con tu historial REAL sobre los conceptos
      const ratio = (() => {
        let ok = 0, total = 0;
        for (const cid of room.concept_ids) {
          const e = tally.current.get(cid);
          if (e) { ok += e.ok; total += e.total; }
        }
        return total ? ok / total : 0.5;
      })();
      const realHard = ratio < 0.55;
      return (
        <div className="mech">
          <p className="mech-prompt">🌡 La mirilla del explorador</p>
          <p className="mech-def">
            Observas la guarida por la rendija. Antes de entrar: ¿qué tan duro
            será ESTE guardián para ti? Tu tasación fija la recompensa — y el
            cartógrafo coteja con tu historial.
          </p>
          <div className="mech-options">
            {([
              ['dificil', '🔥 Difícil para mí (+30 🪙 si lo venzo… y era cierto)'],
              ['parejo', '⚖ Parejo (+15 🪙)'],
              ['facil', '🍃 Fácil para mí (+10 🪙)'],
            ] as const).map(([tasa, label]) => (
              <button key={tasa} className="opt" onClick={() => {
                rated.current.set(room.id, { tasa, realHard });
                emit('G3', {
                  status: 'completed', is_correct: null, partial_score: 1,
                  concepts_involved: room.concept_ids, repertoires_activated: [],
                  cognitive_signals: [{ dimension: 'srl_planeacion', target: room.concept_ids[0] ?? 'sala', delta: 0, confidence: 0.7 }],
                  mechanic_specific: { variante: 'mirilla', tasa, dificultad_real_por_historial: realHard ? 'dificil' : 'manejable', ratio_historial: ratio },
                });
                setOverlay(null);
              }}>{label}</button>
            ))}
          </div>
        </div>
      );
    }

    if (overlay.kind === 'curation') {
      const vistos = Array.from(tally.current.keys())
        .map((id) => materia.concepts.find((c) => c.concept_id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .slice(0, 8);
      return (
        <CurationPanel
          vistos={vistos}
          onDone={(elegidos) => {
            const descartados = vistos.map((c) => c.concept_id).filter((id) => !elegidos.includes(id));
            dispatch({ type: 'SET_CARRIED', concept_ids: elegidos });
            emit('I5', {
              status: 'completed', is_correct: null, partial_score: 1,
              concepts_involved: elegidos, repertoires_activated: [],
              cognitive_signals: [{ dimension: 'srl_autorreflexion', target: 'piso', delta: 0.05, confidence: 0.8 }],
              mechanic_specific: { variante: 'curaduria_mazo', cargados: elegidos, descartados },
            });
            setOverlay(has('I1') ? { kind: 'route' } : null);
            if (!has('I1')) dispatch({ type: 'NEXT_FLOOR' });
          }}
        />
      );
    }

    if (overlay.kind === 'route') {
      const sug: 'acero' | 'peregrino' = state.hearts <= 1 ? 'peregrino' : 'acero';
      const elegir = (route: 'acero' | 'peregrino') => {
        emit('I1', {
          status: 'completed', is_correct: null, partial_score: 1,
          concepts_involved: [], repertoires_activated: [],
          cognitive_signals: [{ dimension: 'srl_planeacion', target: `ruta_piso_${state.floor_index + 1}`, delta: 0.04, confidence: 0.75 }],
          mechanic_specific: { variante: 'ruta_explorador', ruta_elegida: route, sugerida: sug, siguio_sugerencia: route === sug, corazones_al_decidir: state.hearts },
        });
        setOverlay(null);
        dispatch({ type: 'NEXT_FLOOR', route });
      };
      return (
        <div className="mech">
          <p className="mech-prompt">🧭 La mesa de mapas del interpiso</p>
          <p className="mech-def">Dos rutas bajan al piso {state.floor_index + 2}. Elegir la ruta ES tu plan.</p>
          <div className="mech-options">
            <button className="opt" onClick={() => elegir('acero')}>
              ⚔ Ruta del acero — más combate, guardián FEROZ, más botín {sug === 'acero' ? '✨' : ''}
            </button>
            <button className="opt" onClick={() => elegir('peregrino')}>
              🕊 Ruta del peregrino — una fogata extra y un tesoro en el camino {sug === 'peregrino' ? '✨' : ''}
            </button>
          </div>
        </div>
      );
    }

    if (overlay.kind === 'archivo') {
      const pergaminos = room.concept_ids
        .map((id) => materia.concepts.find((c) => c.concept_id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      return (
        <div className="mech archivo-panel">
          <p className="mech-prompt">📚 El Archivo del piso {state.floor_index + 1}</p>
          <p className="mech-def">
            Los pergaminos susurran lo que este piso pondrá a prueba. Leer no es
            saber — pero saber empieza leyendo.
          </p>
          {pergaminos.map((c) => {
            const caso = materia.casos.find((k) => k.concepto_correcto === c.concept_id);
            return (
              <div key={c.concept_id} className="pergamino">
                <strong>📜 {c.label}</strong>
                <p>{c.definicion_formal}</p>
                <p className="perg-intuitiva">En cristiano: {c.definicion_intuitiva}</p>
                {caso && <p className="perg-caso">🧪 Ejemplo: {caso.texto}</p>}
              </div>
            );
          })}
          <div className="mech-options">
            <button className="opt" onClick={() => {
              emit('ARCHIVO', {
                status: 'completed', is_correct: null, partial_score: 1,
                concepts_involved: room.concept_ids, repertoires_activated: [],
                cognitive_signals: [], // leer es EXPOSICIÓN, no evidencia de comprensión
                mechanic_specific: { variante: 'archivo_biblioteca', expuestos: room.concept_ids, modo },
              });
              dispatch({ type: 'CLEAR_ROOM', room_id: room.id });
              setOverlay(null);
            }}>Cerrar los pergaminos y cazar</button>
          </div>
        </div>
      );
    }

    if (overlay.kind === 'spyglass') {
      const clearedN = floor.rooms.filter((r) => r.cleared).length;
      const filas = Array.from(tally.current.entries()).slice(-6);
      return (
        <div className="mech">
          <p className="mech-prompt">🔭 El catalejo</p>
          <p className="mech-def">Piso {state.floor_index + 1}: {clearedN}/{floor.rooms.length} salas resueltas · ♥ {state.hearts} · 🪙 {state.coins}</p>
          <ul className="summary-concepts">
            {filas.map(([id, e]) => {
              const c = materia.concepts.find((x) => x.concept_id === id);
              return <li key={id}><span className={e.ok === e.total ? 'dot good' : 'dot mixed'} />{c?.label ?? id} — {e.ok}/{e.total}</li>;
            })}
          </ul>
          <div className="mech-options">
            <button className="opt" onClick={() => setOverlay(null)}>Cerrar el catalejo</button>
          </div>
        </div>
      );
    }

    if (overlay.kind === 'deal') {
      return (
        <G1Apostar
          conceptLabel={room.type === 'boss' ? 'el JEFE final' : 'el guardián del piso'}
          coins={state.coins}
          onBet={(nivel: NivelConfianza, monedas: number) => {
            dispatch({ type: 'SET_BET', bet: monedas });
            emit('G1', {
              status: 'completed', is_correct: null, partial_score: 1,
              concepts_involved: room.concept_ids, repertoires_activated: [],
              cognitive_signals: [{ dimension: 'srl_calibracion', target: room.concept_ids[0] ?? 'run', delta: 0, confidence: 0.7 }],
              mechanic_specific: { confianza_declarada: nivel, apuesta: monedas, sala: room.type },
            });
            setOverlay(null);
          }}
        />
      );
    }

    if (overlay.kind === 'autopsy') {
      return (
        <G4Autopsia
          conceptLabel={overlay.conceptLabel}
          onDone={(categoria) => {
            // Cotejo con la evidencia conductual: si dice "fui muy rápido" y
            // la latencia observada FUE baja, la autorreflexión es confiable.
            const lat = lastErrorMeta.current?.latencia ?? null;
            const coincide =
              lat !== null && (categoria === 'fui_muy_rapido' ? lat > 0 && lat < 2500 : lat >= 2500);
            emit('G4', {
              status: 'completed', is_correct: null, partial_score: 1,
              concepts_involved: [], repertoires_activated: [],
              cognitive_signals: [{ dimension: 'srl_autorreflexion', target: 'run', delta: 0.05, confidence: coincide ? 0.9 : 0.65 }],
              mechanic_specific: { categoria, latencia_observada_ms: lat, coincide_con_evidencia: coincide },
            });
            dispatch({ type: 'MARK_AUTOPSY' });
            setOverlay(null);
          }}
        />
      );
    }

    if (overlay.kind === 'campfire') {
      // I4: candidatos = tus 4 conceptos objetivamente más flojos de la run
      const scored = materia.concepts
        .map((c) => {
          const e = tally.current.get(c.concept_id);
          return { c, score: e ? e.ok / e.total : 0.5, visto: Boolean(e) };
        })
        .sort((a, b) => Number(b.visto) - Number(a.visto) || a.score - b.score);
      const peorReal = scored[0]?.visto ? scored[0].c.concept_id : null;
      const trabajados = scored.slice(0, 8).map((x) => x.c);
      return (
        <div className="mech">
          <p className="mech-prompt">🔥 La fogata cruje. Descansas.</p>
          <p className="mech-def">
            Reflexiona: ¿qué concepto sientes más flojo? La expedición lo pondrá
            en tu camino — y el descanso te cura un corazón.
          </p>
          <div className="mech-options">
            {trabajados.slice(0, 4).map((c) => (
              <button key={c.concept_id} className="opt" onClick={() => {
                const coincide = peorReal !== null && c.concept_id === peorReal;
                dispatch({ type: 'SET_FOCUS', concept_id: c.concept_id });
                dispatch({ type: 'HEAL', n: 1 });
                dispatch({ type: 'CLEAR_ROOM', room_id: room.id });
                emit('I4', {
                  status: 'completed', is_correct: null, partial_score: 1,
                  concepts_involved: [c.concept_id], repertoires_activated: [],
                  cognitive_signals: [{ dimension: 'srl_autorreflexion', target: c.concept_id, delta: 0.06, confidence: coincide ? 0.9 : 0.7 }],
                  mechanic_specific: { variante: 'seleccion_checkbox', marcado_como_flojo: c.concept_id, coincide_con_sistema: coincide, modo },
                });
                if (modo === 'aprendizaje') {
                  setToast(`📖 ${c.label}: ${c.definicion_intuitiva}`);
                  setTimeout(() => setToast(''), 4200);
                }
                setOverlay(null);
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (overlay.kind === 'minigame') {
      const Comp = CARDS[overlay.piece];
      return (
        <Comp
          config={{ n_opciones: 4, n_intentos_max: 2, tiempo_limite_ms: null }}
          concepts={overlayConcepts()}
          allConcepts={materia.concepts}
          casos={materia.casos}
          relaciones={materia.relaciones}
          rng={rngOverlay}
          onComplete={(result) => {
            const meta = byId(overlay.piece);
            onCog(overlay.piece, result, 10 + (meta?.rank ?? 1) * 6);
            const ok = result.is_correct === true || (result.is_correct === null && result.partial_score >= 0.5);
            dispatch({ type: 'CLEAR_ROOM', room_id: room.id });
            if (ok) {
              dispatch({ type: 'GAIN', coins: 15 });
              setToast('✦ La sala te recompensa: +15 🪙');
            } else {
              setToast('El mecanismo se sella sin botín…');
            }
            setTimeout(() => { setToast(''); setOverlay(null); }, 1400);
          }}
        />
      );
    }

    if (overlay.kind === 'gauntlet') {
      const Comp = CARDS[overlay.piece];
      const meta = byId(overlay.piece);
      return (
        <div className="gauntlet">
          <div className="gauntlet-head">
            <span>{room.type === 'boss' ? '☠ JEFE — Guantelete de ' : '💀 Guardián — Guantelete de '}{meta?.nombre}</span>
            <span className="gauntlet-hp">
              {Array.from({ length: overlay.total }).map((_, i) => (
                <span key={i} className={i < gauntletHp ? 'g-hp' : 'g-hp off'}>■</span>
              ))}
            </span>
          </div>
          <Comp
            key={gauntletHp}
            config={{ n_opciones: 4, n_intentos_max: 1, tiempo_limite_ms: null, es_boss: room.type === 'boss' }}
            concepts={freshConceptsFor(overlay.piece)}
            allConcepts={materia.concepts}
            casos={materia.casos}
            relaciones={materia.relaciones}
            rng={mulberry32(state.seed + gauntletHp * 6151 + state.floor_index)}
            onComplete={(result) => {
              onCog(overlay.piece, result, 20);
              const ok = result.is_correct === true || (result.is_correct === null && result.partial_score >= 0.5);
              if (!ok) onDamage();
              const hp = ok ? gauntletHp - 1 : gauntletHp;
              if (hp <= 0) {
                setOverlay(null);
                onCleared(room.type === 'boss' ? 60 : 25);
                if (room.type === 'boss') dispatch({ type: 'WIN' });
              } else {
                setGauntletHp(hp);
              }
            }}
          />
        </div>
      );
    }
    return null;
  };

  // ---------- Salidas (adyacencia en la grilla) ----------
  const exits = floor.rooms
    .filter((r) => Math.abs(r.gx - room.gx) + Math.abs(r.gy - room.gy) === 1)
    .map((r) => ({
      dir: (r.gx > room.gx ? 'E' : r.gx < room.gx ? 'W' : r.gy > room.gy ? 'S' : 'N') as Dir,
      to: r.id,
    }));

  const pieceLabel = byId(PROP_PIECE[room.type] ?? '')?.nombre;

  return (
    <div className="game crawler">
      <div className="crawl-top">
        <div className="hud">
          <div className="hud-hearts">
            {Array.from({ length: state.max_hearts }).map((_, i) => (
              <span key={i} className={i < state.hearts ? 'heart' : 'heart empty'}>
                {i < state.hearts ? '♥' : '♡'}
              </span>
            ))}
          </div>
          <div className="hud-coins">🪙 {state.coins}</div>
          <div className={`hud-streak ${state.streak >= 2 ? 'hot' : ''}`}>
            🔥 x{multiplier(state.streak).toFixed(1)}
          </div>
          <div className="hud-floor">⛏ {state.floor_index + 1}/5</div>
          <div className="hud-weapon" title={WEAPONS[state.weapon].nombre}>{WEAPONS[state.weapon].icono}</div>
          {state.contract.target !== null && (
            <div className="hud-contract" title="Contrato del piso (G2)">
              📜 {state.contract.ok}/{state.contract.total} → {Math.round(state.contract.target * 100)}%
            </div>
          )}
          {has('I2') && (
            <button className="hud-spyglass" onClick={() => {
              if (overlay) return;
              emit('I2', {
                status: 'completed', is_correct: null, partial_score: 1,
                concepts_involved: [], repertoires_activated: [],
                cognitive_signals: [{ dimension: 'srl_accion', target: 'run', delta: 0.02, confidence: 0.7 }],
                mechanic_specific: { variante: 'catalejo', revision_de_progreso: true, piso: state.floor_index, sala: room.type },
              });
              setOverlay({ kind: 'spyglass' });
            }}>🔭</button>
          )}
          <div className="hud-items">
            {state.items.map((it, i) => (
              <span key={i} className={`hud-item ${it.usado ? 'used' : ''}`}
                title={`${ITEM_CATALOG[it.item_id].nombre} — ${ITEM_CATALOG[it.item_id].descripcion}`}>
                {ITEM_CATALOG[it.item_id].icono}
              </span>
            ))}
          </div>
        </div>
        <Minimap floor={floor} currentId={state.current_room} />
      </div>

      <div className={`room crawl-room ${room.type}`}>
        <div className="room-header">
          <span className="room-kind">
            {ROOM_LABEL[room.type]}
            {pieceLabel ? ` · ${pieceLabel}` : ''}
            {state.bet > 0 && (room.type === 'elite' || room.type === 'boss') ? ` · 😈 trato: ${state.bet} 🪙` : ''}
          </span>
        </div>

        {overlay && <div className="overlay-modal"><div className="overlay-panel">{renderOverlay()}</div></div>}
        {(
          <RoomStage
            key={room.id}
            room={room}
            floorIndex={state.floor_index}
            exits={exits}
            entryDir={entryDir}
            materia={materia}
            pieces={config.pieces}
            paused={Boolean(overlay)}
            weapon={state.weapon}
            scaffold={scaffold}
            rescaffold={rescaffold}
            ecoConcept={state.ecos[0] ?? null}
            onCoins={(n) => dispatch({ type: 'GAIN', coins: n })}
            hasBoots={hasItem(state, 'botas')}
            lupaAvailable={hasItem(state, 'lupa')}
            focusConcept={state.focus_concept}
            onCog={(m, r) => onCog(m, r, m === 'E3' ? 25 : 12)}
            onDamage={onDamage}
            onCleared={(bonus) => {
              onCleared(bonus);
              if (room.type === 'boss') dispatch({ type: 'WIN' });
            }}
            onExit={(to, dir) => {
              setEntryDir(OPP[dir]);
              dispatch({ type: 'MOVE_ROOM', room_id: to });
              errorsInRoom.current = null;
            }}
            onLoot={() => {
              if (room.weapon_id && WEAPONS[room.weapon_id].tier > WEAPONS[state.weapon].tier) {
                dispatch({ type: 'PICK_WEAPON', weapon_id: room.weapon_id });
                setToast(`${WEAPONS[room.weapon_id].icono} ¡${WEAPONS[room.weapon_id].nombre}! Tu brazo se siente distinto.`);
                setTimeout(() => setToast(''), 2200);
              } else if (room.weapon_id) {
                dispatch({ type: 'GAIN', coins: 15 });
                setToast('El arma del cofre es más débil que la tuya: +15 🪙 por chatarra.');
                setTimeout(() => setToast(''), 2200);
              } else if (room.item_id) {
                dispatch({ type: 'PICK_ITEM', item_id: room.item_id });
                setToast(`${ITEM_CATALOG[room.item_id].icono} ${ITEM_CATALOG[room.item_id].nombre}: ${ITEM_CATALOG[room.item_id].descripcion}`);
                setTimeout(() => setToast(''), 2200);
              }
              dispatch({ type: 'GAIN', coins: 10 });
              dispatch({ type: 'CLEAR_ROOM', room_id: room.id });
            }}
            onProp={() => {
              if (room.cleared || overlay) return;
              if (room.type === 'campfire') setOverlay({ kind: 'campfire' });
              else if (room.type === 'archivo') setOverlay({ kind: 'archivo' });
              else setOverlay({ kind: 'minigame', piece: PROP_PIECE[room.type] });
            }}
            onPortal={() => {
              if (pendingCuration.current) return;
              pendingCuration.current = true;
              setTimeout(() => (pendingCuration.current = false), 800);
              setEntryDir(null);
              // G2: revelar el contrato del piso ANTES de bajar (J9)
              if (state.contract.target !== null && state.contract.total > 0) {
                const actual = state.contract.ok / state.contract.total;
                const met = actual >= state.contract.target;
                emit('G2', {
                  status: 'completed', is_correct: met, partial_score: met ? 1 : 0,
                  concepts_involved: [], repertoires_activated: [],
                  cognitive_signals: [{ dimension: 'srl_calibracion', target: `piso_${state.floor_index}`, delta: 0, confidence: 0.85 }],
                  mechanic_specific: { variante: 'contrato_de_piso_cierre', objetivo: state.contract.target, real: actual, calibration_error: Math.abs(state.contract.target - actual), cumplido: met },
                });
                setToast(met ? `📜 Contrato CUMPLIDO: ${Math.round(actual * 100)}% vs ${Math.round(state.contract.target * 100)}% declarado` : `📜 Contrato roto: ${Math.round(actual * 100)}% vs ${Math.round(state.contract.target * 100)}%`);
                setTimeout(() => setToast(''), 2600);
              }
              if (has('I5') && tally.current.size > 0) setOverlay({ kind: 'curation' });
              else if (has('I1')) setOverlay({ kind: 'route' });
              else dispatch({ type: 'NEXT_FLOOR' });
            }}
            onUseLupa={() => {
              if (!scaffold.lupa_gratis) dispatch({ type: 'USE_ITEM', item_id: 'lupa' });
              // I3 PEDIR AYUDA: pedir ayuda a tiempo es señal positiva, nunca penalizada
              emit('I3', {
                status: 'completed', is_correct: null, partial_score: 1,
                concepts_involved: room.concept_ids, repertoires_activated: [],
                cognitive_signals: [{ dimension: 'srl_accion', target: room.concept_ids[0] ?? 'run', delta: 0.04, confidence: 0.8 }],
                mechanic_specific: { tipo_de_hint: 'eliminar_un_distractor', sala: room.type, piso: state.floor_index },
              });
            }}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
        {diag && (
          <div className="diag-badge">
            🩺 {diag}
            <button onClick={() => setDiag('')}>×</button>
          </div>
        )}
      </div>

      <p className="seed-note">
        piezas {config.pieces.join('·')} · semilla {state.seed} · WASD/flechas mueven · click dispara
      </p>
    </div>
  );
}

const ROOM_LABEL: Record<string, string> = {
  start: 'Entrada de la mazmorra',
  archivo: 'El Archivo — biblioteca del piso',
  campfire: 'Fogata del explorador',
  hunt: 'Sala de caza',
  specter: 'Cámara del espectro',
  door: 'Puerta rúnica',
  shrine: 'Santuario',
  altar: 'Altar de clasificación',
  bridge: 'Puente de runas',
  treasure: 'Sala del tesoro',
  elite: 'Guarida del guardián',
  boss: 'Trono del jefe final',
};

// ---------- Síntesis: campamento post-muerte (G4) + mapa del cartógrafo (G5) ----------

type Evidence = { errLow: number; errHigh: number; dmg: number; betLost: number; rapidos: number };

function Summary({
  state,
  materia,
  emit,
  cartografo,
  deathcamp,
  evidence,
}: {
  state: DungeonState;
  materia: typeof CURSO_DEMO;
  emit: (id: string, r: MechanicResult) => void;
  cartografo: boolean;
  deathcamp: boolean;
  evidence: Evidence;
}) {
  const [step, setStep] = useState<'camp' | 'summary'>(deathcamp ? 'camp' : 'summary');
  const [marks, setMarks] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const porConcepto = new Map<string, { ok: number; total: number }>();
  if (typeof window !== 'undefined') {
    try {
      const log: MechanicOutput[] = JSON.parse(localStorage.getItem(`event_log_${state.run_id}`) ?? '[]');
      for (const o of log) {
        for (const c of o.concepts_involved) {
          const e = porConcepto.get(c) ?? { ok: 0, total: 0 };
          e.total += 1;
          if (o.partial_score >= 0.5) e.ok += 1;
          porConcepto.set(c, e);
        }
      }
    } catch { /* sin log */ }
  }
  const label = (id: string) => materia.concepts.find((x) => x.concept_id === id)?.label ?? id;

  // El veredicto del sistema sobre "qué te mató", desde la evidencia conductual
  const sistemaCree = (): string => {
    const pesos: Record<string, number> = {
      concepto: evidence.errLow * 2,
      presion: evidence.errHigh + Math.max(0, evidence.dmg - 2),
      apuesta: evidence.betLost * 3,
      prisa: evidence.rapidos * 2,
    };
    return Object.entries(pesos).sort((a, b) => b[1] - a[1])[0][0];
  };

  if (step === 'camp') {
    const veredicto = sistemaCree();
    const opciones: { id: string; texto: string; icono: string }[] = [
      { id: 'concepto', texto: 'Un concepto que no dominaba', icono: '📖' },
      { id: 'presion', texto: 'El caos — demasiados enemigos', icono: '🦇' },
      { id: 'apuesta', texto: 'Mi propia soberbia: aposté de más', icono: '😈' },
      { id: 'prisa', texto: 'La prisa: respondí sin leer', icono: '💨' },
    ];
    return (
      <div className="game">
        <div className="summary lost">
          <h1>🏕 El campamento entre vidas</h1>
          <p className="mech-def">
            La fogata del más allá cruje. El guardián del campamento pregunta,
            sin juzgar: <strong>¿qué te mató allá abajo?</strong> Tu respuesta
            forja una bendición contra esa causa para la próxima expedición.
          </p>
          <div className="mech-options">
            {opciones.map((o) => (
              <button key={o.id} className="opt" onClick={() => {
                const coincide = o.id === veredicto;
                emit('G4', {
                  status: 'completed', is_correct: null, partial_score: 1,
                  concepts_involved: [], repertoires_activated: [],
                  cognitive_signals: [{ dimension: 'srl_autorreflexion', target: 'muerte', delta: 0.06, confidence: coincide ? 0.9 : 0.65 }],
                  mechanic_specific: {
                    variante: 'campamento_post_muerte', causa_declarada: o.id,
                    causa_segun_evidencia: veredicto, coincide_con_evidencia: coincide,
                    evidencia: { ...evidence },
                  },
                });
                try { localStorage.setItem('expedicion_bendicion', JSON.stringify({ vs: o.id })); } catch { /* */ }
                setStep('summary');
              }}>
                {o.icono} {o.texto}
              </button>
            ))}
          </div>
          <p className="mech-hint">La bendición te esperará al iniciar la próxima run.</p>
        </div>
      </div>
    );
  }

  const won = state.status === 'won';
  // Las 2 presas más duras según el cartógrafo (tu tally real)
  const delSistema = Array.from(porConcepto.entries())
    .filter(([, e]) => e.total >= 1)
    .sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total)
    .slice(0, 2)
    .map(([id]) => id);
  const coincidencias = marks.filter((m) => delSistema.includes(m)).length;

  return (
    <div className="game">
      <div className={`summary ${won ? 'won' : 'lost'}`}>
        <h1>{won ? '✦ ¡Las 5 mazmorras cayeron!' : '☠ La expedición terminó'}</h1>
        <div className="summary-stats">
          <span>🪙 {state.coins}</span>
          <span>🔥 racha: {state.best_streak}</span>
          <span>♥ {won ? state.hearts : 0}/{state.max_hearts}</span>
          <span>⛏ piso {state.floor_index + 1}</span>
        </div>

        {state.contract_log.length > 0 && (
          <div className="contract-log">
            <h2>📜 Contratos de piso</h2>
            <ul>
              {state.contract_log.map((c) => (
                <li key={c.floor} className={c.met ? 'met' : 'broken'}>
                  Piso {c.floor + 1}: declaraste {Math.round(c.target * 100)}%, lograste {Math.round(c.actual * 100)}% {c.met ? '✓' : '✗'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2>{cartografo ? '🗺 El mapa del cartógrafo' : 'Lo que trabajaste'}</h2>
        {cartografo && !revealed && (
          <p className="mech-hint">Marca hasta 2 presas que te costaron — luego el cartógrafo revelará las suyas.</p>
        )}
        <ul className="summary-concepts">
          {Array.from(porConcepto.entries()).map(([id, e]) => {
            const marked = marks.includes(id);
            const sys = revealed && delSistema.includes(id);
            return (
              <li key={id} className={cartografo && !revealed ? 'clickable' : ''} onClick={() => {
                if (!cartografo || revealed) return;
                setMarks((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length < 2 ? [...m, id] : m));
              }}>
                <span className={e.ok === e.total ? 'dot good' : 'dot mixed'} />
                {label(id)} — {e.ok}/{e.total} {marked && '🏆'} {sys && '🗺'}
              </li>
            );
          })}
        </ul>
        {cartografo && !revealed && marks.length > 0 && (
          <button className="btn-primary" onClick={() => {
            setRevealed(true);
            emit('G5', {
              status: 'completed', is_correct: null, partial_score: 1,
              concepts_involved: marks, repertoires_activated: [],
              cognitive_signals: [{ dimension: 'srl_autorreflexion', target: 'run', delta: 0.05, confidence: 0.8 }],
              mechanic_specific: {
                variante: 'mapa_cartografo', marcas_estudiante: marks,
                marcas_sistema: delSistema, coincidencias,
                calibration_error_retrospectivo: 1 - coincidencias / Math.max(1, marks.length),
              },
            });
          }}>
            🗺 Revelar las marcas del cartógrafo
          </button>
        )}
        {revealed && (
          <p className={`prophecy-result ${coincidencias > 0 ? 'good' : ''}`}>
            {coincidencias === marks.length && marks.length > 0
              ? '¡Tu mapa y el del cartógrafo coinciden! Te conoces bien.'
              : coincidencias > 0
                ? 'Coinciden en parte — mira dónde el cartógrafo vio otra cosa (🗺).'
                : 'El cartógrafo vio otras presas difíciles (🗺). Ahí hay algo que no notaste.'}
          </p>
        )}

        <div className="summary-actions">
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Nueva expedición
          </button>
          <a className="btn-primary alt" href="/">⚒ Cambiar piezas</a>
        </div>
      </div>
    </div>
  );
}

// ---------- I5 · Panel de curaduría ----------
function CurationPanel({
  vistos,
  onDone,
}: {
  vistos: { concept_id: string; label: string }[];
  onDone: (elegidos: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="mech">
      <p className="mech-prompt">🎒 Curaduría del mazo</p>
      <p className="mech-def">
        El portal zumba. Elige hasta 3 conceptos que LLEVAS al siguiente piso
        (su botín pagará ×1.5). Los que sueltes… es porque ya los cargas dentro.
      </p>
      <div className="mech-options curation-grid">
        {vistos.map((c) => (
          <button key={c.concept_id}
            className={`opt ${sel.includes(c.concept_id) ? 'ammo-on' : ''}`}
            onClick={() => setSel((m) => m.includes(c.concept_id) ? m.filter((x) => x !== c.concept_id) : m.length < 3 ? [...m, c.concept_id] : m)}>
            {sel.includes(c.concept_id) ? '🎒' : '·'} {c.label}
          </button>
        ))}
      </div>
      <button className="btn-primary" onClick={() => onDone(sel)}>
        Descender ({sel.length}/3 en el mazo)
      </button>
    </div>
  );
}
