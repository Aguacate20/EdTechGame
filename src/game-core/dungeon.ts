import type { ItemId, MateriaPrima, Concept } from './types';
import { weaponForFloor, type WeaponId } from './weapons';
import { mulberry32, pick, sample, shuffle, uuid } from './rng';

// ============================================================
// Capa 2 · Juego — Dungeon crawler (v0.3)
// 5 mazmorras procedurales de 4-8 salas. La generación respeta:
// - El RNG (seed) decide topología, botín, qué conceptos caen dónde.
// - Las PIEZAS elegidas deciden qué TIPOS de sala existen (cada pieza
//   es un verbo de juego, no un tipo de pregunta).
// - Escalado: los pisos avanzan de recuperación a transferencia;
//   el jefe del piso 5 es la pieza más exigente seleccionada.
// ============================================================

export type RoomType =
  | 'start'
  | 'archivo' // biblioteca: exposición previa (modo aprendizaje)
  | 'campfire' // I4
  | 'hunt' // A1 combate de caza
  | 'specter' // B1 espectro de orbes
  | 'door' // A2 puerta rúnica
  | 'shrine' // A3 santuario de invocación
  | 'altar' // B2 altar de clasificación
  | 'bridge' // C1 puente de runas
  | 'treasure' // botín (mimic si hay repertorio)
  | 'elite' // fin de pisos 1-4
  | 'boss'; // fin del piso 5

export interface DRoom {
  id: string;
  gx: number; // coordenada de grilla (minimapa)
  gy: number;
  type: RoomType;
  concept_ids: string[];
  mimic: boolean;
  item_id?: ItemId;
  weapon_id?: WeaponId;
  feroz?: boolean; // ruta del acero: élite/jefe con más vida y más botín
  cleared: boolean;
  visited: boolean;
}

export interface DFloor {
  index: number;
  rooms: DRoom[];
}

export interface DungeonConfig {
  pieces: string[];
  seed?: number;
  modo?: 'aprendizaje' | 'evaluacion'; // default: evaluacion
}

export type DungeonStatus = 'active' | 'won' | 'game_over';

export interface DungeonState {
  run_id: string;
  seed: number;
  config: DungeonConfig;
  status: DungeonStatus;
  floor_index: number;
  floors: DFloor[];
  current_room: string; // room id
  hearts: number;
  max_hearts: number;
  coins: number;
  streak: number;
  best_streak: number;
  items: { item_id: ItemId; usado: boolean }[];
  focus_concept: string | null; // I4: enfoque elegido en la fogata
  weapon: WeaponId;
  ecos: string[]; // conceptos caídos por repertorio, reaparecen para re-testear anclaje
  // G2 · Contrato de piso: declaras % de aciertos y el cierre lo revela (J9)
  contract: { target: number | null; ok: number; total: number };
  contract_log: { floor: number; target: number; actual: number; met: boolean }[];
  // I5 · Curaduría: conceptos que decides "llevar" al siguiente piso (buff leve)
  carried: string[];
  prophecy: number | null; // G2: corazones estimados al final
  autopsy_done_floor: number; // G4: máx una autopsia por piso
  bet: number; // G1: apuesta activa en la sala élite/jefe
  bet_lost: boolean;
}

export const multiplier = (streak: number) => 1 + Math.min(streak, 5) * 0.2;

// ---------- Generación procedural ----------

const PRIMARY_ROOM: Record<string, RoomType> = {
  A1: 'hunt',
  B1: 'specter',
  A2: 'door',
  A3: 'shrine',
  B2: 'altar',
  C1: 'bridge',
};
const COMBAT: RoomType[] = ['hunt', 'specter'];

export function generateDungeon(
  materia: MateriaPrima,
  config: DungeonConfig
): DungeonState {
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = mulberry32(seed);
  const has = (p: string) => config.pieces.includes(p);

  const conceptPool = shuffle(rng, materia.concepts);
  let ci = 0;
  const nextConcept = (filtro?: (c: Concept) => boolean): Concept => {
    for (let k = 0; k < conceptPool.length; k++) {
      const c = conceptPool[(ci + k) % conceptPool.length];
      if (!filtro || filtro(c)) {
        ci = (ci + k + 1) % conceptPool.length;
        return c;
      }
    }
    return conceptPool[ci++ % conceptPool.length];
  };
  const conCaso = (c: Concept) =>
    materia.casos.some((k) => k.concepto_correcto === c.concept_id);
  const conFragmento = (c: Concept) => Boolean(c.fragmento);
  const conRepertorio = (c: Concept) => Boolean(c.distractor_caracterizado);
  const relPool = shuffle(rng, materia.relaciones);
  let ri = 0;

  // Tipos de sala habilitados por las piezas primarias elegidas
  const combatTypes = COMBAT.filter((t) =>
    Object.entries(PRIMARY_ROOM).some(([p, rt]) => rt === t && has(p))
  );
  const minigameTypes = (['door', 'shrine', 'altar', 'bridge'] as RoomType[]).filter(
    (t) => Object.entries(PRIMARY_ROOM).some(([p, rt]) => rt === t && has(p))
  );

  const conceptsFor = (type: RoomType, floor: number): string[] => {
    switch (type) {
      case 'hunt':
      case 'specter':
        return [nextConcept().concept_id, nextConcept().concept_id];
      case 'door':
        return [nextConcept(conFragmento).concept_id];
      case 'shrine':
        return [nextConcept().concept_id];
      case 'altar':
        return [nextConcept(conCaso).concept_id];
      case 'bridge': {
        const r = relPool[ri++ % relPool.length];
        return [r.origen, r.destino];
      }
      case 'elite':
        return [nextConcept(conCaso).concept_id];
      case 'boss':
        return [
          nextConcept(conCaso).concept_id,
          nextConcept(conCaso).concept_id,
          nextConcept(conCaso).concept_id,
        ];
      case 'treasure':
        return [nextConcept(conRepertorio).concept_id];
      default:
        return [];
    }
  };

  const floors: DFloor[] = [];
  for (let f = 0; f < 5; f++) {
    const n = 4 + Math.floor(rng() * 3); // 4-6 salas
    // Random walk en grilla
    const cells: { gx: number; gy: number }[] = [{ gx: 0, gy: 0 }];
    const taken = new Set(['0,0']);
    while (cells.length < n) {
      const from = cells[Math.floor(rng() * cells.length)];
      const dir = pick(rng, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
      const gx = from.gx + dir[0];
      const gy = from.gy + dir[1];
      const key = `${gx},${gy}`;
      if (!taken.has(key)) {
        taken.add(key);
        cells.push({ gx, gy });
      }
    }

    // Asignación de tipos: [0]=inicio/fogata, [n-1]=élite/jefe,
    // 1 tesoro garantizado, resto mezcla de combate (peso 2) y minijuegos.
    const middlePool: RoomType[] = [];
    for (const t of combatTypes) middlePool.push(t, t);
    for (const t of minigameTypes) middlePool.push(t);
    if (!middlePool.length) middlePool.push('treasure');

    const treasureIdx =
      cells.length > 3 ? 1 + Math.floor(rng() * (cells.length - 2)) : -1;
    const rooms: DRoom[] = cells.map((c, i) => {
      let type: RoomType;
      if (i === 0) type = has('I4') && f > 0 ? 'campfire' : 'start';
      else if (i === cells.length - 1) type = f < 4 ? 'elite' : 'boss';
      else if (i === treasureIdx) type = 'treasure';
      else type = pick(rng, middlePool);

      const concept_ids = conceptsFor(type, f);
      const baseConcept = materia.concepts.find(
        (x) => x.concept_id === concept_ids[0]
      );
      return {
        id: `f${f}r${i}`,
        gx: c.gx,
        gy: c.gy,
        type,
        concept_ids,
        mimic:
          type === 'treasure' && baseConcept?.distractor_caracterizado
            ? rng() < 0.5
            : false,
        item_id:
          type === 'treasure' && rng() < 0.5
            ? pick(rng, ['botas', 'amuleto', 'lupa'] as ItemId[])
            : undefined,
        weapon_id: undefined,
        cleared: type === 'start' || type === 'campfire',
        visited: i === 0,
      };
    });
    for (const r of rooms) {
      if (r.type === 'treasure' && !r.item_id) r.weapon_id = weaponForFloor(f);
    }
    // Cobertura de señal: si hay piezas de minijuego elegidas pero el piso
    // salió 100% combate, convertir una sala para no sobre-representar
    // recuperación (riesgo señalado en la matriz §5.1).
    if (minigameTypes.length) {
      const mid = rooms.slice(1, -1);
      if (mid.length > 1 && mid.every((r) => COMBAT.includes(r.type) || r.type === 'treasure')) {
        const idx = rooms.findIndex((r, i) => i > 0 && i < rooms.length - 1 && COMBAT.includes(r.type));
        if (idx > 0) {
          const t = pick(rng, minigameTypes);
          rooms[idx] = { ...rooms[idx], type: t, concept_ids: conceptsFor(t, f), mimic: false };
        }
      }
    }
    // Modo aprendizaje: sala-Archivo con los pergaminos del piso (pisos 1-3)
    if ((config.modo ?? 'evaluacion') === 'aprendizaje' && f <= 2) {
      const conceptosPiso = Array.from(new Set(rooms.flatMap((r) => r.concept_ids))).slice(0, 5);
      // Celda libre adyacente a la entrada
      const takenKeys = new Set(rooms.map((r) => `${r.gx},${r.gy}`));
      const base = rooms[0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${base.gx + dx},${base.gy + dy}`;
        if (!takenKeys.has(key)) {
          rooms.splice(1, 0, {
            id: `f${f}archivo`,
            gx: base.gx + dx,
            gy: base.gy + dy,
            type: 'archivo',
            concept_ids: conceptosPiso,
            mimic: false,
            cleared: false,
            visited: false,
          });
          break;
        }
      }
    }
    floors.push({ index: f, rooms });
  }

  return {
    run_id: uuid(rng),
    seed,
    config,
    status: 'active',
    floor_index: 0,
    floors,
    current_room: floors[0].rooms[0].id,
    hearts: 3,
    max_hearts: 3,
    coins: 0,
    streak: 0,
    best_streak: 0,
    items: [],
    focus_concept: null,
    weapon: 'piedra',
    ecos: [],
    contract: { target: null, ok: 0, total: 0 },
    contract_log: [],
    carried: [],
    prophecy: null,
    autopsy_done_floor: -1,
    bet: 0,
    bet_lost: false,
  };
}

// ---------- Reducer ----------

export type DungeonAction =
  | { type: 'DAMAGE' }
  | { type: 'GAIN'; coins: number }
  | { type: 'COG'; correct: boolean; reward: number } // evento cognitivo: racha + monedas
  | { type: 'MOVE_ROOM'; room_id: string }
  | { type: 'CLEAR_ROOM'; room_id: string }
  | { type: 'PICK_ITEM'; item_id: ItemId }
  | { type: 'PICK_WEAPON'; weapon_id: WeaponId }
  | { type: 'ADD_ECO'; concept_id: string }
  | { type: 'CONSUME_ECO'; concept_id: string }
  | { type: 'USE_ITEM'; item_id: ItemId }
  | { type: 'NEXT_FLOOR'; route?: 'acero' | 'peregrino' }
  | { type: 'SET_CONTRACT'; target: number }
  | { type: 'SET_CARRIED'; concept_ids: string[] }
  | { type: 'WIN' }
  | { type: 'HEAL'; n: number }
  | { type: 'SET_FOCUS'; concept_id: string | null }
  | { type: 'SET_PROPHECY'; n: number }
  | { type: 'SET_BET'; bet: number }
  | { type: 'MARK_AUTOPSY' }
  | { type: 'REVIVE' }; // modo aprendizaje: la mazmorra no mata, te escupe

export function dungeonReducer(s: DungeonState, a: DungeonAction): DungeonState {
  if (a.type === 'REVIVE') {
    if (s.status !== 'game_over') return s;
    return {
      ...s,
      status: 'active',
      hearts: s.max_hearts,
      current_room: s.floors[s.floor_index].rooms[0].id,
      bet: 0,
      bet_lost: false,
    };
  }
  if (s.status !== 'active' && a.type !== 'SET_PROPHECY') return s;
  const floor = s.floors[s.floor_index];

  switch (a.type) {
    case 'DAMAGE': {
      const hearts = s.hearts - 1;
      // G1: el trato se pierde al primer golpe en la sala apostada
      const bet_lost = s.bet > 0 ? true : s.bet_lost;
      const coins = bet_lost && !s.bet_lost ? Math.max(0, s.coins - s.bet) : s.coins;
      return {
        ...s,
        hearts,
        coins,
        bet: bet_lost ? 0 : s.bet,
        bet_lost,
        streak: 0,
        status: hearts <= 0 ? 'game_over' : s.status,
      };
    }
    case 'GAIN':
      return { ...s, coins: s.coins + a.coins };
    case 'COG': {
      const contract =
        s.contract.target !== null
          ? { ...s.contract, ok: s.contract.ok + (a.correct ? 1 : 0), total: s.contract.total + 1 }
          : s.contract;
      if (a.correct) {
        const streak = s.streak + 1;
        return {
          ...s,
          contract,
          streak,
          best_streak: Math.max(s.best_streak, streak),
          coins: s.coins + Math.round(a.reward * multiplier(streak)),
        };
      }
      return { ...s, contract, streak: 0 };
    }
    case 'MOVE_ROOM': {
      const rooms = floor.rooms.map((r) =>
        r.id === a.room_id ? { ...r, visited: true } : r
      );
      return {
        ...s,
        floors: s.floors.map((f, i) => (i === s.floor_index ? { ...f, rooms } : f)),
        current_room: a.room_id,
      };
    }
    case 'CLEAR_ROOM': {
      const rooms = floor.rooms.map((r) =>
        r.id === a.room_id ? { ...r, cleared: true } : r
      );
      // G1: sala apostada superada sin perder el trato → pago 2×
      const win = s.bet > 0 && a.room_id === s.current_room;
      return {
        ...s,
        floors: s.floors.map((f, i) => (i === s.floor_index ? { ...f, rooms } : f)),
        coins: win ? s.coins + s.bet : s.coins,
        bet: 0,
      };
    }
    case 'PICK_ITEM':
      return { ...s, items: [...s.items, { item_id: a.item_id, usado: false }] };
    case 'PICK_WEAPON':
      return { ...s, weapon: a.weapon_id };
    case 'ADD_ECO':
      return s.ecos.includes(a.concept_id) ? s : { ...s, ecos: [...s.ecos, a.concept_id] };
    case 'CONSUME_ECO':
      return { ...s, ecos: s.ecos.filter((e) => e !== a.concept_id) };
    case 'USE_ITEM':
      return {
        ...s,
        items: s.items.map((i) =>
          i.item_id === a.item_id && !i.usado ? { ...i, usado: true } : i
        ),
      };
    case 'NEXT_FLOOR': {
      // G2: el cierre del piso revela el contrato (J9) y paga si se cumplió
      let coins = s.coins;
      let contract_log = s.contract_log;
      if (s.contract.target !== null && s.contract.total > 0) {
        const actual = s.contract.ok / s.contract.total;
        const met = actual >= s.contract.target;
        if (met) coins += s.contract.target >= 0.9 ? 45 : s.contract.target >= 0.7 ? 25 : 10;
        contract_log = [
          ...contract_log,
          { floor: s.floor_index, target: s.contract.target, actual, met },
        ];
      }
      const ni = s.floor_index + 1;
      if (ni >= s.floors.length) return { ...s, coins, contract_log, status: 'won' };
      // I1: la ruta elegida transforma el siguiente piso
      const floors = a.route ? applyRoute(s, ni, a.route) : s.floors;
      return {
        ...s,
        floors,
        coins,
        contract_log,
        contract: { target: null, ok: 0, total: 0 },
        floor_index: ni,
        current_room: floors[ni].rooms[0].id,
        bet: 0,
        bet_lost: false,
      };
    }
    case 'WIN': {
      let coins = s.coins;
      let contract_log = s.contract_log;
      if (s.contract.target !== null && s.contract.total > 0) {
        const actual = s.contract.ok / s.contract.total;
        const met = actual >= s.contract.target;
        if (met) coins += s.contract.target >= 0.9 ? 45 : s.contract.target >= 0.7 ? 25 : 10;
        contract_log = [...contract_log, { floor: s.floor_index, target: s.contract.target, actual, met }];
      }
      return { ...s, coins, contract_log, status: 'won' };
    }
    case 'HEAL':
      return { ...s, hearts: Math.min(s.max_hearts, s.hearts + a.n) };
    case 'SET_FOCUS':
      return { ...s, focus_concept: a.concept_id };
    case 'SET_PROPHECY':
      return { ...s, prophecy: a.n };
    case 'SET_BET':
      return { ...s, bet: a.bet, bet_lost: false };
    case 'MARK_AUTOPSY':
      return { ...s, autopsy_done_floor: s.floor_index };
    case 'SET_CONTRACT':
      return { ...s, contract: { target: a.target, ok: 0, total: 0 } };
    case 'SET_CARRIED':
      return { ...s, carried: a.concept_ids.slice(0, 3) };
    default:
      return s;
  }
}

/** I1 · Ruta del explorador: transforma el siguiente piso según el plan.
 *  acero: una sala tranquila se vuelve combate y el final es FEROZ (+vida, +botín).
 *  peregrino: una sala de combate se vuelve fogata y aparece un tesoro extra. */
export function applyRoute(
  s: DungeonState,
  floorIdx: number,
  route: 'acero' | 'peregrino'
): DFloor[] {
  const rng = mulberry32(s.seed ^ (floorIdx * 7919));
  const floor = s.floors[floorIdx];
  const rooms = floor.rooms.map((r) => ({ ...r }));
  const middle = (pred: (r: DRoom) => boolean) => {
    for (let i = 1; i < rooms.length - 1; i++) if (pred(rooms[i])) return i;
    return -1;
  };
  if (route === 'acero') {
    const i = middle((r) => ['door', 'shrine', 'altar', 'bridge'].includes(r.type));
    if (i >= 0) {
      const extra = rooms[(i + 1) % rooms.length].concept_ids[0] ?? rooms[i].concept_ids[0];
      rooms[i] = {
        ...rooms[i],
        type: rng() < 0.5 ? 'hunt' : 'specter',
        concept_ids: [rooms[i].concept_ids[0] ?? extra, extra],
        cleared: false,
      };
    }
    const last = rooms[rooms.length - 1];
    rooms[rooms.length - 1] = { ...last, feroz: true };
  } else {
    const i = middle((r) => r.type === 'hunt' || r.type === 'specter');
    if (i >= 0) rooms[i] = { ...rooms[i], type: 'campfire', cleared: false };
    const j = middle((r) => (r.type === 'hunt' || r.type === 'specter') && !r.item_id && !r.weapon_id);
    if (j >= 0 && j !== i)
      rooms[j] = {
        ...rooms[j],
        type: 'treasure',
        item_id: pick(rng, ['botas', 'amuleto', 'lupa'] as ItemId[]),
        mimic: false,
        cleared: false,
      };
  }
  return s.floors.map((f, k) => (k === floorIdx ? { ...f, rooms } : f));
}

export const currentFloor = (s: DungeonState) => s.floors[s.floor_index];
export const roomById = (s: DungeonState, id: string) =>
  currentFloor(s).rooms.find((r) => r.id === id)!;
export const hasItem = (s: DungeonState, id: ItemId) =>
  s.items.some((i) => i.item_id === id && !i.usado);

/** Sorteo de piezas para el constructor (decisión Y jugable) */
export function shufflePieces(seed?: number): string[] {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
  const primarias = shuffle(rng, ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'E3']).slice(
    0,
    2 + Math.floor(rng() * 3)
  );
  const meta = shuffle(rng, ['G1', 'G2', 'G3', 'G4', 'G5', 'I1', 'I2', 'I4', 'I5']).slice(
    0,
    1 + Math.floor(rng() * 2)
  );
  return [...primarias, ...meta];
}
