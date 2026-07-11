'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Concept, MateriaPrima, MechanicResult } from '@/game-core/types';
import type { DRoom } from '@/game-core/dungeon';
import { WEAPONS, type WeaponId } from '@/game-core/weapons';
import { scaffoldSignal, type Scaffold } from '@/game-core/scaffold';
import { mulberry32, pick, sample, shuffle } from '@/game-core/rng';
import { Demon, Hero, Slime, SLIME_COLORS } from '@/theme/Sprites';
import { useInput } from './useInput';

// ============================================================
// RoomStage v0.4 — anatomía Soul Knight de una sala:
//   PISO DE HABILIDAD: enemigos básicos (sin etiqueta, mueren a tu arma,
//     dan monedas, CERO señal cognitiva) + rocas de cobertura + ráfagas.
//   CAPA COGNITIVA encima: objetivos etiquetados, orbes, hilos, casos.
// REGLAS DE SEÑAL:
//   - El comportamiento ES señal: latencia, intentos, duda, timeout.
//   - La presión (básicos vivos) modula la CONFIANZA, nunca la dirección.
//   - Los objetivos etiquetados mueren por CONOCIMIENTO (un impacto
//     correcto), jamás por estadísticas del arma.
// ============================================================

const W = 160;
const H = 90;
const MARGIN = 7;

export type Dir = 'N' | 'S' | 'E' | 'W';

interface Rock { x: number; y: number; w: number; h: number; }
interface Basic {
  id: number; kind: 'bat' | 'blob';
  x: number; y: number; tx: number; ty: number;
  hp: number; dead: boolean;
}
interface LSlime {
  id: number; x: number; y: number; tx: number; ty: number;
  label: string; correcta: boolean; repertoire_id?: string;
  angry: boolean; dead: boolean; color: string;
}
interface Orb {
  id: number; x: number; y: number; texto: string; correcta: boolean;
  repertoire_id?: string; born: number; done: boolean;
}
interface Thread {
  id: number; x: number; y: number; ang: number;
  tipo: string; correcta: boolean; esInversa: boolean; done: boolean;
}
interface Shot { id: number; x: number; y: number; vx: number; vy: number; dmg: number; pierce: boolean; hitIds: number[]; }
interface EProj { id: number; x: number; y: number; vx: number; vy: number; }

export interface StageProps {
  room: DRoom;
  floorIndex: number;
  exits: { dir: Dir; to: string }[];
  entryDir: Dir | null;
  materia: MateriaPrima;
  pieces: string[];
  paused: boolean;
  weapon: WeaponId;
  scaffold: Scaffold;
  rescaffold: boolean; // doc 01 §6: el andamio regresa si los errores suben
  hasBoots: boolean;
  lupaAvailable: boolean;
  focusConcept: string | null;
  ecoConcept: string | null;
  onCog: (mechanicId: string, result: MechanicResult) => void;
  onDamage: () => void;
  onCoins: (n: number) => void;
  onCleared: (bonusCoins: number) => void;
  onExit: (to: string, dir: Dir) => void;
  onLoot: () => void;
  onProp: () => void;
  onPortal: () => void;
  onUseLupa: () => void;
}

const DOOR_POS: Record<Dir, { x: number; y: number }> = {
  N: { x: W / 2, y: 4 }, S: { x: W / 2, y: H - 4 },
  W: { x: 5, y: H / 2 }, E: { x: W - 5, y: H / 2 },
};
const spawnFor = (entry: Dir | null) => {
  if (!entry) return { x: W / 2, y: H * 0.72 };
  const d = DOOR_POS[entry];
  return {
    x: d.x + (entry === 'W' ? 11 : entry === 'E' ? -11 : 0),
    y: d.y + (entry === 'N' ? 11 : entry === 'S' ? -11 : 0),
  };
};
const PROP = { x: W / 2, y: 38 };
const COMBAT_TYPES = ['hunt', 'specter', 'bridge', 'elite', 'boss'];
const BASIC_TYPES = ['hunt', 'specter', 'bridge', 'door', 'shrine', 'altar', 'elite', 'boss'];

export function RoomStage(p: StageProps) {
  const input = useInput();
  const [, setTick] = useState(0);
  const rng = useMemo(() => mulberry32(hash(p.room.id) ^ 0x9e37), [p.room.id]);

  // ---------- Mundo ----------
  const player = useRef(spawnFor(p.entryDir));
  const aim = useRef({ x: W / 2, y: 20 });
  const firing = useRef(false);
  const lastShot = useRef(0);
  const iframeUntil = useRef(0);
  const rocks = useRef<Rock[]>([]);
  const basics = useRef<Basic[]>([]);
  const slimes = useRef<LSlime[]>([]);
  const orbs = useRef<Orb[]>([]);
  const threads = useRef<Thread[]>([]);
  const shots = useRef<Shot[]>([]);
  const eprojs = useRef<EProj[]>([]);
  const demon = useRef<{ x: number; y: number; enragedUntil: number; hp: number; maxHp: number; burstAt: number; lastHit: number } | null>(null);
  const wave = useRef(0);
  const phase = useRef(0);
  const waveStart = useRef(0);
  const attempts = useRef(0);
  const mimicOn = useRef(false);
  const chestOpened = useRef(false);
  const clearedRef = useRef(p.room.cleared);
  const pausedRef = useRef(p.paused);
  pausedRef.current = p.paused;
  const idc = useRef(1);
  const stageEl = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState('');
  const [spellSet, setSpellSet] = useState<Concept[]>([]);
  const [casoTexto, setCasoTexto] = useState('');
  const [ammo, setAmmo] = useState<Concept | null>(null);
  const ammoRef = useRef<Concept | null>(null);
  ammoRef.current = ammo;
  const emittedAmmo = useRef(new Set<string>());
  const readingSince = useRef(0);

  // Gracia de aparición: 1.4s de invulnerabilidad al entrar a la sala y
  // 1.2s al despausar (cerrar el trato G1, fogatas, altares). Nadie muere
  // por materializarse encima de un murciélago.
  useEffect(() => {
    iframeUntil.current = performance.now() + 1400;
  }, [p.room.id]);
  useEffect(() => {
    if (!p.paused) iframeUntil.current = Math.max(iframeUntil.current, performance.now() + 1200);
  }, [p.paused]);

  const conceptOf = useCallback(
    (id: string) => p.materia.concepts.find((c) => c.concept_id === id)!,
    [p.materia]
  );
  // Ecos de anclaje > enfoque de fogata > concepto de la sala
  const waveConcept = (i: number): { id: string; eco: boolean } => {
    if (i === 0 && p.room.type === 'hunt') {
      if (p.ecoConcept) return { id: p.ecoConcept, eco: true };
      if (p.focusConcept) return { id: p.focusConcept, eco: false };
    }
    return { id: p.room.concept_ids[i] ?? p.room.concept_ids[0], eco: false };
  };
  const presion = () => basics.current.filter((b) => !b.dead).length + (demon.current ? 1 : 0);
  const hintOn = () =>
    (p.scaffold.hint_tras_errores !== null && attempts.current >= p.scaffold.hint_tras_errores) ||
    (p.rescaffold && attempts.current >= 2);
  // Principio 2: la presión modula la CONFIANZA de la señal
  const conf = (base: number) => Math.max(0.55, base - 0.07 * Math.min(presion(), 3));

  // ---------- Generación del escenario ----------
  const genRocks = useCallback(() => {
    const n = 3 + Math.floor(rng() * 3);
    const out: Rock[] = [];
    let guard = 0;
    while (out.length < n && guard++ < 40) {
      const w = 10 + rng() * 12, h = 7 + rng() * 8;
      const x = 18 + rng() * (W - 36 - w), y = 16 + rng() * (H - 34 - h);
      const cx = x + w / 2, cy = y + h / 2;
      if (Math.hypot(cx - W / 2, cy - H * 0.72) < 22) continue; // spawn del héroe
      if (Math.hypot(cx - PROP.x, cy - PROP.y) < 20) continue; // zona del prop
      if (Math.abs(cx - W / 2) < 14 || Math.abs(cy - H / 2) < 11) continue; // carriles de puertas
      out.push({ x, y, w, h });
    }
    rocks.current = out;
  }, [rng]);

  const spawnBasics = useCallback(() => {
    if (!BASIC_TYPES.includes(p.room.type) || p.room.cleared) return;
    const n = Math.max(1, Math.round((2 + Math.floor(p.floorIndex / 2) + Math.floor(rng() * 2)) * p.scaffold.basics_mul));
    basics.current = Array.from({ length: n }).map(() => {
      const kind = rng() < 0.55 ? 'bat' : 'blob';
      let x = 0, y = 0, guard = 0;
      do { x = 15 + rng() * (W - 30); y = 12 + rng() * (H - 40); }
      while (Math.hypot(x - player.current.x, y - player.current.y) < 30 && guard++ < 20);
      return { id: idc.current++, kind, x, y, tx: x, ty: y, hp: kind === 'bat' ? 1 : 2, dead: false } as Basic;
    });
  }, [p.room.type, p.room.cleared, p.floorIndex, rng]);

  const spawnHuntWave = useCallback((w: number) => {
    const wc = waveConcept(w);
    const objetivo = conceptOf(wc.id);
    setBanner(`🎯 ${objetivo.definicion_formal}`);
    waveStart.current = performance.now();
    attempts.current = 0;
    const nTotal = p.scaffold.n_slimes;
    const opts: { label: string; correcta: boolean; repertoire_id?: string }[] = [
      { label: objetivo.label, correcta: true },
    ];
    if (p.scaffold.senuelos && objetivo.distractor_caracterizado)
      opts.push({ label: objetivo.distractor_caracterizado.label, correcta: false, repertoire_id: objetivo.distractor_caracterizado.repertoire_id });
    for (const o of sample(rng, p.materia.concepts.filter((c) => c.concept_id !== wc.id), nTotal - opts.length))
      opts.push({ label: o.label, correcta: false });
    slimes.current = shuffle(rng, opts).map((o, i) => {
      let x = 0, y = 0, guard = 0;
      do { x = 20 + rng() * (W - 40); y = 12 + rng() * (H - 46); }
      while (Math.hypot(x - player.current.x, y - player.current.y) < 28 && guard++ < 20);
      return {
      id: idc.current++,
      x, y,
      tx: 20 + rng() * (W - 40), ty: 12 + rng() * (H - 46),
      label: o.label, correcta: o.correcta, repertoire_id: o.repertoire_id,
      angry: false, dead: false, color: SLIME_COLORS[(i + w) % SLIME_COLORS.length],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id]);

  const spawnOrbPair = useCallback((conceptId: string, mimic = false) => {
    const c = conceptOf(conceptId);
    const rep = mimic
      ? p.materia.repertoires.find((r) => r.repertoire_id === c.distractor_caracterizado?.repertoire_id)
      : null;
    const pares = mimic
      ? [
          { texto: c.definicion_intuitiva, correcta: true },
          { texto: rep?.enunciado ?? c.enunciado_incorrecto, correcta: false, repertoire_id: rep?.repertoire_id },
        ]
      : [
          { texto: c.enunciado_correcto, correcta: true },
          { texto: c.enunciado_incorrecto, correcta: false },
        ];
    waveStart.current = performance.now();
    orbs.current = shuffle(rng, pares).map((o, i) => ({
      id: idc.current++, x: W * 0.28 + i * W * 0.44, y: 11,
      texto: o.texto, correcta: o.correcta,
      repertoire_id: (o as { repertoire_id?: string }).repertoire_id,
      born: performance.now(), done: false,
    }));
    setBanner(mimic ? '👹 ¡El cofre era un MIMIC! Toca la verdad, esquiva tu intuición.' : `👻 Sobre ${c.label}: toca el orbe VERDADERO, esquiva el falso.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id]);

  const spawnThreads = useCallback(() => {
    const [oId, dId] = p.room.concept_ids;
    const rel = p.materia.relaciones.find(
      (r) => (r.origen === oId && r.destino === dId) || (r.origen === dId && r.destino === oId)
    );
    if (!rel) { clearedRef.current = true; p.onCleared(0); return; }
    const tipos = ['es_prerequisito_de', 'contrasta_con', 'es_parte_de', 'causa', 'se_mide_con'];
    const otros = sample(rng, tipos.filter((t) => t !== rel.tipo), 2);
    waveStart.current = performance.now();
    const defs = shuffle(rng, [
      { tipo: rel.tipo, correcta: true, esInversa: rel.origen !== oId },
      ...otros.map((t) => ({ tipo: t, correcta: false, esInversa: false })),
    ]);
    threads.current = defs.map((d, i) => ({
      id: idc.current++,
      x: W / 2 + Math.cos((i / defs.length) * Math.PI * 2) * 28,
      y: H / 2 + Math.sin((i / defs.length) * Math.PI * 2) * 20,
      ang: (i / defs.length) * Math.PI * 2,
      ...d, done: false,
    }));
    setBanner(`🌉 Teje: ${conceptOf(oId).label} —¿?→ ${conceptOf(dId).label}. Atrapa el hilo verdadero.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id]);

  const armPhase = useCallback((ph: number) => {
    const cid = p.room.concept_ids[ph];
    const objetivo = conceptOf(cid);
    const casos = p.materia.casos.filter((k) => k.concepto_correcto === cid);
    setCasoTexto(casos[Math.floor(rng() * casos.length)]?.texto ?? objetivo.definicion_intuitiva);
    setSpellSet(shuffle(rng, [objetivo, ...sample(rng, p.materia.concepts.filter((c) => c.concept_id !== cid), 3)]));
    readingSince.current = performance.now();
    setAmmo(null);
    emittedAmmo.current.clear();
    if (demon.current) demon.current.hp = demon.current.maxHp;
    setBanner('📜 Lee el caso esquivando. Elige tu MUNICIÓN conceptual: solo el concepto que lo explica hace daño pleno.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id]);

  // ---------- Inicialización por tipo de sala ----------
  useEffect(() => {
    genRocks();
    spawnBasics();
    if (p.room.cleared) return;
    if (p.room.type === 'hunt') spawnHuntWave(0);
    else if (p.room.type === 'specter') spawnOrbPair(waveConcept(0).id);
    else if (p.room.type === 'bridge') spawnThreads();
    else if ((p.room.type === 'elite' || p.room.type === 'boss') && p.pieces.includes('E3')) {
      const maxHp = (p.room.type === 'boss' ? 6 : 5) + (p.room.feroz ? 2 : 0);
      const dy = player.current.y < H / 2 ? H - 24 : 20;
      demon.current = { x: W / 2, y: dy, enragedUntil: 0, hp: maxHp, maxHp, burstAt: performance.now() + 2600, lastHit: 0 };
      armPhase(0);
    } else if (['door', 'shrine', 'altar'].includes(p.room.type) && basics.current.length) {
      setBanner('⚔ Derrota a los guardianes para activar el mecanismo.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id]);

  // ---------- Resoluciones cognitivas ----------
  const specific = (extra: Record<string, unknown>) => ({
    latencia_ms: Math.round(performance.now() - waveStart.current),
    intentos_previos: attempts.current,
    presion: presion(),
    ...extra,
  });

  const cogHunt = (s: LSlime) => {
    const wc = waveConcept(wave.current);
    const reps = !s.correcta && s.repertoire_id ? [s.repertoire_id] : [];
    const primerIntento = attempts.current === 0;
    const hintActivo = hintOn();
    const mod = scaffoldSignal(p.scaffold, hintActivo);
    p.onCog('A1', {
      status: 'completed',
      is_correct: s.correcta,
      partial_score: s.correcta ? (primerIntento ? 1 : 0.5) : 0,
      concepts_involved: [wc.id],
      repertoires_activated: reps,
      cognitive_signals: [
        { dimension: 'recuperacion', target: wc.id, delta: (s.correcta ? (primerIntento ? 0.08 : 0.03) : -0.05) * (s.correcta ? mod.deltaMul : 1), confidence: conf(s.correcta && primerIntento ? 0.9 : 0.8) * mod.confMul },
        ...reps.map((r) => ({ dimension: 'anclaje' as const, target: r, delta: 0.1, confidence: 0.9 })),
        ...(wc.eco && s.correcta ? [{ dimension: 'anclaje' as const, target: wc.id, delta: -0.08, confidence: 0.8 }] : []),
      ],
      mechanic_specific: specific({ variante: 'crawler_caza', golpeado: s.label, wave: wave.current, primer_disparo_correcto: s.correcta && primerIntento, eco_de_anclaje: wc.eco ? wc.id : null, andamiaje: p.scaffold.nivel, hint_activo: hintActivo }),
    });
    if (s.correcta) {
      s.dead = true;
      if (wave.current + 1 < p.room.concept_ids.length) {
        wave.current += 1;
        setTimeout(() => !pausedRef.current && spawnHuntWave(wave.current), 650);
      } else finishCombat(12);
    } else {
      attempts.current += 1;
      s.angry = true;
      // El feedback no corrige: contextualiza (doc 00, Test 4)
      const golpeado = p.materia.concepts.find((c) => c.label === s.label);
      if (s.repertoire_id) {
        const rep = p.materia.repertoires.find((r) => r.repertoire_id === s.repertoire_id);
        setBanner(`⚠ Activaste tu intuición: "${rep?.enunciado ?? s.label}". Útil en lo cotidiano — aquí buscabas otra cosa.`);
      } else if (golpeado) {
        setBanner(`◌ Golpeaste ${golpeado.label}: ${golpeado.definicion_intuitiva}. La definición pide otro.`);
      }
    }
  };

  const cogOrb = (o: Orb, mimic: boolean) => {
    const cid = mimic ? p.room.concept_ids[0] : waveConcept(wave.current).id;
    const reps = !o.correcta && o.repertoire_id ? [o.repertoire_id] : [];
    p.onCog('B1', {
      status: 'completed',
      is_correct: o.correcta,
      partial_score: o.correcta ? 1 : 0,
      concepts_involved: [cid],
      repertoires_activated: reps,
      cognitive_signals: [
        { dimension: 'recuperacion', target: cid, delta: o.correcta ? 0.05 : -0.04, confidence: conf(0.8) },
        ...reps.map((r) => ({ dimension: 'anclaje' as const, target: r, delta: 0.1, confidence: 0.9 })),
      ],
      mechanic_specific: specific({ variante: mimic ? 'crawler_mimic' : 'crawler_espectro', texto: o.texto, tiempo_compromiso_ms: Math.round(performance.now() - o.born), wave: wave.current, andamiaje: p.scaffold.nivel }),
    });
    orbs.current = [];
    if (!o.correcta && !p.scaffold.errores_gratis) p.onDamage();
    if (!o.correcta && p.scaffold.errores_gratis) setBanner('◌ El orbe falso te atraviesa sin herirte — el archivo aún te protege. Lee por qué era falso arriba.');
    if (mimic) { chestOpened.current = true; mimicOn.current = false; p.onLoot(); return; }
    if (wave.current + 1 < p.room.concept_ids.length) {
      wave.current += 1;
      setTimeout(() => !pausedRef.current && spawnOrbPair(waveConcept(wave.current).id), 650);
    } else finishCombat(10);
  };

  const cogThread = (t: Thread) => {
    const [oId, dId] = p.room.concept_ids;
    p.onCog('C1', {
      status: 'completed',
      is_correct: t.correcta,
      partial_score: t.correcta ? 1 : 0,
      concepts_involved: [oId, dId],
      repertoires_activated: [],
      cognitive_signals: [
        { dimension: 'relacion', target: `${oId}→${dId}`, delta: t.correcta ? 0.08 : -0.05, confidence: conf(0.8) },
      ],
      mechanic_specific: specific({ variante: 'crawler_puente', tipo_elegido: t.tipo, error_tipo: !t.correcta ? 'tipo' : t.esInversa ? 'direccion_invertida' : null }),
    });
    if (t.correcta) {
      threads.current = [];
      finishCombat(15);
      setBanner('🌉 El puente se teje. La sala te recompensa.');
    } else {
      attempts.current += 1;
      t.done = true;
      setBanner('✖ El hilo se rompe entre tus manos…');
      if (threads.current.every((x) => x.done || x.correcta === false)) {
        const quedan = threads.current.filter((x) => !x.done);
        if (!quedan.length || quedan.every((x) => !x.correcta)) finishCombat(0);
      }
    }
  };

  // E3 · Munición conceptual: el primer impacto con cada munición ES la
  // afirmación cognitiva (una señal por munición por fase). El daño depende
  // de la semántica: correcto = pleno; relacionado en el grafo = medio
  // (partial_score 0.5, transferencia cercana); ajeno = cero + contraataque.
  const resolveAmmoHit = (dm: NonNullable<typeof demon.current>, c: Concept, wpnDmg: number): number => {
    const cid = p.room.concept_ids[phase.current];
    const ok = c.concept_id === cid;
    const related =
      !ok &&
      p.materia.relaciones.some(
        (r) =>
          (r.origen === c.concept_id && r.destino === cid) ||
          (r.origen === cid && r.destino === c.concept_id)
      );
    const key = `${phase.current}-${c.concept_id}`;
    if (!emittedAmmo.current.has(key)) {
      emittedAmmo.current.add(key);
      p.onCog('E3', {
        status: 'completed',
        is_correct: ok ? true : related ? null : false,
        partial_score: ok ? 1 : related ? 0.5 : 0,
        concepts_involved: [cid],
        repertoires_activated: [],
        cognitive_signals: [
          { dimension: 'transferencia', target: cid, delta: ok ? 0.08 : related ? 0.02 : -0.06, confidence: conf(0.85) },
        ],
        mechanic_specific: specific({
          variante: 'municion_conceptual',
          municion: c.concept_id,
          semantica: ok ? 'correcta' : related ? 'cluster_cercano' : 'ajena',
          fase: phase.current,
          deliberacion_ms: Math.round(performance.now() - readingSince.current),
        }),
      });
      if (!ok && !related) {
        attempts.current += 1;
        dm.enragedUntil = performance.now() + 2200;
        burst(dm.x, dm.y, 7);
        setBanner(`✖ "${c.label}" no explica este caso. ¡Contraataque!`);
      } else if (related) {
        setBanner(`◐ "${c.label}" roza el caso (cluster cercano): daño a medias.`);
      } else {
        setBanner('💥 ¡Munición correcta! Tu conocimiento muerde.');
      }
    }
    return ok ? wpnDmg : related ? wpnDmg / 2 : 0;
  };

  const finishCombat = (bonus: number) => {
    clearedRef.current = true;
    setBanner('');
    p.onCleared(bonus);
  };

  const burst = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.3;
      eprojs.current.push({ id: idc.current++, x, y, vx: Math.cos(a) * 42, vy: Math.sin(a) * 42 });
    }
  };

  // ---------- Colisión con rocas ----------
  const pushOut = (e: { x: number; y: number }, r: number) => {
    for (const rk of rocks.current) {
      const cx = Math.max(rk.x, Math.min(e.x, rk.x + rk.w));
      const cy = Math.max(rk.y, Math.min(e.y, rk.y + rk.h));
      const dx = e.x - cx, dy = e.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < r && d > 0.001) { e.x = cx + (dx / d) * r; e.y = cy + (dy / d) * r; }
      else if (d <= 0.001) { e.y = rk.y - r; }
    }
  };
  const hitsRock = (x: number, y: number) =>
    rocks.current.some((rk) => x > rk.x - 1 && x < rk.x + rk.w + 1 && y > rk.y - 1 && y < rk.y + rk.h + 1);

  // ---------- Loop principal ----------
  useEffect(() => {
    let raf = 0;
    let alive = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setTick((t) => t + 1); // SIEMPRE renderizar (fix de pantalla incompleta)
      if (pausedRef.current) return;

      const wp = WEAPONS[p.weapon];
      const pl = player.current;

      // Jugador
      const k = input.current;
      const spd = 52 * (p.hasBoots ? 1.3 : 1);
      let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (dx && dy) { dx *= 0.707; dy *= 0.707; }
      pl.x = Math.max(MARGIN, Math.min(W - MARGIN, pl.x + dx * spd * dt));
      pl.y = Math.max(MARGIN, Math.min(H - MARGIN, pl.y + dy * spd * dt));
      pushOut(pl, 4.5);

      // Disparo del arma (mantener presionado)
      if (firing.current && now - lastShot.current >= wp.cadencia_ms) {
        lastShot.current = now;
        const ax = aim.current.x - pl.x, ay = aim.current.y - pl.y;
        const d = Math.hypot(ax, ay) || 1;
        shots.current.push({ id: idc.current++, x: pl.x, y: pl.y, vx: (ax / d) * wp.vel, vy: (ay / d) * wp.vel, dmg: wp.dmg, pierce: wp.pierce, hitIds: [] });
      }

      // Salidas
      const canExit = clearedRef.current || p.room.cleared || !COMBAT_TYPES.includes(p.room.type);
      if (canExit) {
        for (const e of p.exits) {
          const d = DOOR_POS[e.dir];
          if (Math.abs(pl.x - d.x) < 9 && Math.abs(pl.y - d.y) < 9) { p.onExit(e.to, e.dir); return; }
        }
      }

      const hurt = () => {
        if (now < iframeUntil.current) return;
        iframeUntil.current = now + 1100;
        p.onDamage();
      };

      // Básicos (piso de habilidad)
      for (const b of basics.current) {
        if (b.dead) continue;
        if (b.kind === 'bat') {
          const ddx = pl.x - b.x, ddy = pl.y - b.y;
          const d = Math.hypot(ddx, ddy) || 1;
          b.x += (ddx / d) * 26 * dt; b.y += (ddy / d) * 26 * dt;
        } else {
          const ddx = b.tx - b.x, ddy = b.ty - b.y;
          const d = Math.hypot(ddx, ddy);
          if (d < 3) { b.tx = 15 + Math.random() * (W - 30); b.ty = 12 + Math.random() * (H - 40); }
          else { b.x += (ddx / d) * 13 * dt; b.y += (ddy / d) * 13 * dt; }
        }
        pushOut(b, 4);
        if (Math.hypot(pl.x - b.x, pl.y - b.y) < 8) hurt();
      }

      // Slimes etiquetados
      for (const s of slimes.current) {
        if (s.dead) continue;
        const sp = s.angry ? 30 : 15;
        const ddx = s.tx - s.x, ddy = s.ty - s.y;
        const d = Math.hypot(ddx, ddy);
        if (d < 3) { s.tx = 15 + Math.random() * (W - 30); s.ty = 12 + Math.random() * (H - 44); }
        else { s.x += (ddx / d) * sp * dt; s.y += (ddy / d) * sp * dt; }
        pushOut(s, 4.5);
        if (Math.hypot(pl.x - s.x, pl.y - s.y) < 9) hurt();
      }

      // Hilos (C1) orbitan
      for (const t of threads.current) {
        if (t.done) continue;
        t.ang += 0.5 * dt;
        t.x = W / 2 + Math.cos(t.ang) * 28;
        t.y = H / 2 + Math.sin(t.ang) * 20;
        if (Math.hypot(pl.x - t.x, pl.y - t.y) < 8) { cogThread(t); break; }
      }

      // Disparos del jugador
      shots.current = shots.current.filter((sh) => {
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        if (sh.x < 2 || sh.x > W - 2 || sh.y < 2 || sh.y > H - 2 || hitsRock(sh.x, sh.y)) return false;
        // Básicos: mueren al arma (monedas, sin señal)
        for (const b of basics.current) {
          if (b.dead || sh.hitIds.includes(b.id)) continue;
          if (Math.hypot(sh.x - b.x, sh.y - b.y) < 6) {
            b.hp -= sh.dmg;
            if (b.hp <= 0) { b.dead = true; p.onCoins(2); }
            if (!sh.pierce) return false;
            sh.hitIds.push(b.id);
          }
        }
        // Etiquetados: golpear = afirmación cognitiva
        for (const s of slimes.current) {
          if (!s.dead && Math.hypot(sh.x - s.x, sh.y - s.y) < 7) { cogHunt(s); return false; }
        }
        // Jefe/élite: el daño depende de la MUNICIÓN conceptual elegida
        const dm = demon.current;
        if (dm && Math.hypot(sh.x - dm.x, sh.y - dm.y) < (p.room.type === 'boss' ? 10 : 8)) {
          if (!ammoRef.current) {
            setBanner('⚠ Elige una munición conceptual abajo: sin ella tus disparos no muerden.');
            return false;
          }
          const dmg = resolveAmmoHit(dm, ammoRef.current, sh.dmg);
          if (dmg > 0) {
            dm.hp -= dmg;
            dm.lastHit = now;
            if (dm.hp <= 0) {
              if (p.room.type === 'boss' && phase.current + 1 < p.room.concept_ids.length) {
                phase.current += 1;
                armPhase(phase.current);
                burst(dm.x, dm.y, 10);
              } else {
                demon.current = null;
                finishCombat((p.room.type === 'boss' ? 60 : 25) + (p.room.feroz ? 15 : 0));
              }
            }
          }
          return false;
        }
        return true;
      });

      // Orbes (homing suave)
      const isMimic = mimicOn.current;
      for (const o of orbs.current) {
        if (o.done) continue;
        const ddx = pl.x - o.x, ddy = pl.y - o.y;
        const d = Math.hypot(ddx, ddy) || 1;
        const osp = 17 * p.scaffold.orb_speed_mul;
        o.x += (ddx / d) * osp * dt; o.y += (ddy / d) * osp * dt;
        if (d < 9) { o.done = true; cogOrb(o, isMimic); break; }
        if (now - o.born > 14000) {
          orbs.current = [];
          p.onCog('B1', {
            status: 'timeout', is_correct: false, partial_score: 0,
            concepts_involved: [isMimic ? p.room.concept_ids[0] : waveConcept(wave.current).id],
            repertoires_activated: [],
            cognitive_signals: [
              { dimension: 'recuperacion', target: waveConcept(wave.current).id, delta: -0.02, confidence: 0.55 },
            ],
            mechanic_specific: specific({ variante: 'crawler_espectro', timeout: true, nota: 'evasion_sin_compromiso' }),
          });
          if (!isMimic && wave.current + 1 < p.room.concept_ids.length) { wave.current += 1; spawnOrbPair(waveConcept(wave.current).id); }
          else if (!isMimic) finishCombat(0);
          else { chestOpened.current = true; mimicOn.current = false; p.onLoot(); }
          break;
        }
      }

      // Demonio (élite/jefe E3)
      const dm = demon.current;
      if (dm && !p.room.cleared) {
        const enraged = now < dm.enragedUntil;
        const herido = dm.hp < dm.maxHp;
        const sp = enraged ? 34 : herido ? 21 : 17;
        const ddx = pl.x - dm.x, ddy = pl.y - dm.y;
        const d = Math.hypot(ddx, ddy) || 1;
        dm.x += (ddx / d) * sp * dt; dm.y += (ddy / d) * sp * dt;
        if (d < 11) { hurt(); dm.x -= (ddx / d) * 14; dm.y -= (ddy / d) * 14; }
        if (now >= dm.burstAt) {
          dm.burstAt = now + (enraged ? 1600 : p.room.feroz ? 2100 : 2700);
          burst(dm.x, dm.y, (p.room.type === 'boss' ? 8 : 6) + (p.room.feroz ? 2 : 0));
        }
      }

      // Proyectiles enemigos
      eprojs.current = eprojs.current.filter((ep) => {
        ep.x += ep.vx * dt; ep.y += ep.vy * dt;
        if (ep.x < 2 || ep.x > W - 2 || ep.y < 2 || ep.y > H - 2 || hitsRock(ep.x, ep.y)) return false;
        if (Math.hypot(pl.x - ep.x, pl.y - ep.y) < 6) { hurt(); return false; }
        return true;
      });

      // Interacciones por contacto
      if (!clearedRef.current && !p.room.cleared) {
        const nearProp = Math.hypot(pl.x - PROP.x, pl.y - PROP.y) < 11;
        if (p.room.type === 'treasure' && !chestOpened.current && !mimicOn.current && nearProp) {
          if (p.room.mimic) { mimicOn.current = true; spawnOrbPair(p.room.concept_ids[0], true); }
          else { chestOpened.current = true; p.onLoot(); }
        }
        if (['door', 'shrine', 'altar'].includes(p.room.type) && nearProp) {
          if (basics.current.every((b) => b.dead)) p.onProp();
        }
        if ((p.room.type === 'campfire' || p.room.type === 'archivo') && nearProp) p.onProp();
      }
      if (p.room.cleared && p.room.type === 'elite') {
        if (Math.hypot(pl.x - W / 2, pl.y - 22) < 9) { p.onPortal(); return; }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.room.id, p.room.cleared, p.exits, p.weapon]);

  // ---------- Puntería / disparo ----------
  const toUnits = (e: React.PointerEvent) => {
    const box = stageEl.current!.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * W, y: ((e.clientY - box.top) / box.height) * H };
  };
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); // mata drag nativo y el autoscroll del botón central
    if (p.paused || e.button === 1 || e.button === 2) return;
    aim.current = toUnits(e);
    firing.current = true;
    lastShot.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    if (firing.current) { e.preventDefault(); aim.current = toUnits(e); }
  };
  const stopFire = () => { firing.current = false; };

  const usarLupa = () => {
    const cand = slimes.current.find((s) => !s.dead && !s.correcta && !s.repertoire_id);
    if (!cand) return;
    cand.dead = true;
    p.onUseLupa(); // en modo andamiado, el padre no consume el ítem pero SÍ emite I3
  };

  const pl = player.current;
  const dm = demon.current;
  const now = performance.now();
  const invul = now < iframeUntil.current;
  const propSealed = ['door', 'shrine', 'altar'].includes(p.room.type) && basics.current.some((b) => !b.dead);
  const px = (x: number) => `${(x / W) * 100}%`;
  const py = (y: number) => `${(y / H) * 100}%`;

  return (
    <div className="stage-wrap">
      <div className="stage-banner">{banner || ' '}</div>
      <div className="stage" ref={stageEl} draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={stopFire} onPointerLeave={stopFire}>

        {rocks.current.map((r, i) => (
          <div key={i} className="rock" style={{ left: px(r.x), top: py(r.y), width: px(r.w), height: `${(r.h / H) * 100}%` }} />
        ))}

        {p.exits.map((e) => {
          const d = DOOR_POS[e.dir];
          const locked = COMBAT_TYPES.includes(p.room.type) && !clearedRef.current && !p.room.cleared;
          return (
            <div key={e.dir} className={`door-slab ${e.dir.toLowerCase()} ${locked ? 'locked' : ''}`} style={{ left: px(d.x), top: py(d.y) }}>
              {locked ? '🔒' : ''}
            </div>
          );
        })}

        {/* Props */}
        {p.room.type === 'treasure' && !chestOpened.current && !mimicOn.current && (
          <div className="prop chest" style={{ left: px(PROP.x), top: py(PROP.y) }}>🎁</div>
        )}
        {p.room.type === 'door' && <div className={`prop gate ${p.room.cleared ? 'open' : ''} ${propSealed ? 'sealed' : ''}`} style={{ left: px(PROP.x), top: py(PROP.y) }}>🚪</div>}
        {p.room.type === 'shrine' && <div className={`prop ${propSealed ? 'sealed' : ''}`} style={{ left: px(PROP.x), top: py(PROP.y) }}>🗿</div>}
        {p.room.type === 'altar' && <div className={`prop ${propSealed ? 'sealed' : ''}`} style={{ left: px(PROP.x), top: py(PROP.y) }}>⚗️</div>}
        {p.room.type === 'campfire' && <div className="prop fire" style={{ left: px(PROP.x), top: py(PROP.y) }}>🔥</div>}
        {p.room.type === 'archivo' && <div className={`prop ${p.room.cleared ? 'open' : ''}`} style={{ left: px(PROP.x), top: py(PROP.y) }}>📚</div>}
        {p.room.type === 'bridge' && (
          <>
            <div className="pillar" style={{ left: px(24), top: py(H / 2) }}>🗼<span className="ent-label">{conceptOf(p.room.concept_ids[0])?.label}</span></div>
            <div className="pillar" style={{ left: px(W - 24), top: py(H / 2) }}>🗼<span className="ent-label">{conceptOf(p.room.concept_ids[1])?.label}</span></div>
          </>
        )}
        {p.room.cleared && p.room.type === 'elite' && (
          <div className="prop portal" style={{ left: px(W / 2), top: py(22) }}>🌀</div>
        )}
        {p.room.type === 'specter' && !p.room.cleared && !clearedRef.current && (
          <div className="specter" style={{ left: px(W / 2), top: py(9) }}>👻</div>
        )}

        {/* Básicos */}
        {basics.current.filter((b) => !b.dead).map((b) => (
          <div key={b.id} className={`ent basic ${b.kind}`} style={{ left: px(b.x), top: py(b.y) }}>
            {b.kind === 'bat' ? '🦇' : '🟣'}
            {b.kind === 'blob' && b.hp === 1 && <span className="hp-chip">·</span>}
          </div>
        ))}

        {/* Slimes etiquetados */}
        {slimes.current.filter((s) => !s.dead).map((s) => (
          <div key={s.id} className={`ent slime-ent ${s.angry ? 'angry' : ''} ${s.correcta && hintOn() ? 'hinted' : ''}`} style={{ left: px(s.x), top: py(s.y) }}>
            <Slime color={s.color} px={4} />
            <span className="ent-label">{s.label}</span>
          </div>
        ))}

        {/* Orbes */}
        {orbs.current.filter((o) => !o.done).map((o) => (
          <div key={o.id} className="ent orb" style={{ left: px(o.x), top: py(o.y) }}>
            <span className="orb-glow" />
            <span className="ent-label orb-label">{o.texto}</span>
          </div>
        ))}

        {/* Hilos C1 */}
        {threads.current.filter((t) => !t.done).map((t) => (
          <div key={t.id} className="ent thread" style={{ left: px(t.x), top: py(t.y) }}>
            <span className="thread-glow" />
            <span className="ent-label">{t.tipo.replaceAll('_', ' ')}</span>
          </div>
        ))}

        {/* Demonio + barra */}
        {dm && !p.room.cleared && (
          <div className={`ent demon-ent ${now < dm.enragedUntil ? 'enraged' : ''} ${now - dm.lastHit < 350 ? 'vulnerable' : ''} ${p.room.feroz ? 'feroz' : ''}`} style={{ left: px(dm.x), top: py(dm.y) }}>
            <Demon px={p.room.type === 'boss' ? 7 : 5} />
            <span className="boss-bar"><span className="boss-fill" style={{ width: `${(dm.hp / dm.maxHp) * 100}%` }} /></span>
          </div>
        )}

        {shots.current.map((sh) => <div key={sh.id} className="shot" style={{ left: px(sh.x), top: py(sh.y) }} />)}
        {eprojs.current.map((ep) => <div key={ep.id} className="eproj" style={{ left: px(ep.x), top: py(ep.y) }} />)}

        <div className={`ent hero-ent ${invul ? 'invul' : ''}`} style={{ left: px(pl.x), top: py(pl.y) }}>
          <Hero px={4} />
        </div>

        {/* D-pad dentro del área de juego: nada lo tapa */}
        <div className="dpad">
          {(['up', 'left', 'down', 'right'] as const).map((d) => (
            <button key={d} className={`dpad-btn ${d}`}
              onPointerDown={(e) => { e.stopPropagation(); input.current[d] = true; }}
              onPointerUp={() => (input.current[d] = false)}
              onPointerLeave={() => (input.current[d] = false)}>
              {d === 'up' ? '▲' : d === 'down' ? '▼' : d === 'left' ? '◀' : '▶'}
            </button>
          ))}
        </div>
      </div>

      {dm && !p.room.cleared && (
        <div className="spell-panel">
          <p className="combat-bubble stage-caso">{casoTexto}</p>
          <div className="spell-row">
            {spellSet.map((c) => (
              <button
                key={c.concept_id}
                className={`opt spell ${ammo?.concept_id === c.concept_id ? 'ammo-on' : ''}`}
                onClick={() => setAmmo(c)}
              >
                {ammo?.concept_id === c.concept_id ? '🔻' : '⚡'} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.room.type === 'hunt' && (p.lupaAvailable || p.scaffold.lupa_gratis) && !p.room.cleared && (
        <button className="item-btn" onClick={usarLupa}>
          🔍 {p.scaffold.lupa_gratis ? 'Pedir ayuda al archivo (gratis aquí)' : 'Usar Lupa (ahuyenta un slime falso)'}
        </button>
      )}
    </div>
  );
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
