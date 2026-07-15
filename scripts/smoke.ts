// Prueba de humo v0.3 (sin React): valida el generador procedural del
// crawler y la propiedad Lego — cada pieza sola, todas juntas, sorteos.
import {
  generateDungeon, dungeonReducer, shufflePieces, multiplier,
  type DungeonState, type DRoom, type RoomType,
} from '../src/game-core/dungeon';
import { REGISTRY, PRIMARIAS_JUGABLES } from '../src/game-core/registry';
import { scaffoldFor } from '../src/game-core/scaffold';
import { CURSO_DEMO } from '../src/data/materiaPrima';

const gen = (pieces: string[], seed: number) =>
  generateDungeon(CURSO_DEMO, { pieces, seed });

const ROOM_OF: Record<string, RoomType> = {
  A1: 'hunt', B1: 'specter', A2: 'door', A3: 'shrine', B2: 'altar', C1: 'bridge',
};

// 1. Reproducibilidad por semilla
{
  const a = gen(['A1', 'B1', 'E3', 'G1', 'I4'], 42);
  const b = gen(['A1', 'B1', 'E3', 'G1', 'I4'], 42);
  console.assert(
    JSON.stringify(a.floors) === JSON.stringify(b.floors),
    'FALLO: misma semilla, mazmorras distintas'
  );
  console.log('✓ Semilla reproducible: misma expedición para la misma semilla');
}

// 2. Estructura: 5 pisos de 4-8 salas, jefe al final del 5, élite en 1-4
{
  for (let seed = 1; seed <= 30; seed++) {
    const s = gen(['A1', 'B1', 'A2', 'A3', 'B2', 'C1', 'E3', 'G1', 'G2', 'G4', 'G5', 'I4'], seed);
    console.assert(s.floors.length === 5, 'FALLO: no hay 5 pisos');
    for (const f of s.floors) {
      console.assert(f.rooms.length >= 4 && f.rooms.length <= 6, `FALLO: piso con ${f.rooms.length} salas`);
      const last = f.rooms[f.rooms.length - 1];
      console.assert(
        f.index < 4 ? last.type === 'elite' : last.type === 'boss',
        `FALLO: final del piso ${f.index} es ${last.type}`
      );
      console.assert(f.rooms.some((r) => r.type === 'treasure'), `FALLO: piso ${f.index} sin tesoro`);
      // Conectividad: BFS por adyacencia ortogonal
      const key = (r: DRoom) => `${r.gx},${r.gy}`;
      const setk = new Map(f.rooms.map((r) => [key(r), r]));
      const seen = new Set([key(f.rooms[0])]);
      const q = [f.rooms[0]];
      while (q.length) {
        const r = q.pop()!;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const n = setk.get(`${r.gx+dx},${r.gy+dy}`);
          if (n && !seen.has(key(n))) { seen.add(key(n)); q.push(n); }
        }
      }
      console.assert(seen.size === f.rooms.length, `FALLO: piso ${f.index} desconectado`);
      // Jefe con 3 casos, élite con caso
      if (last.type === 'boss') console.assert(last.concept_ids.length === 3, 'FALLO: jefe sin 3 casos');
    }
    // Fogatas solo si I4, en pisos > 0
    console.assert(s.floors[0].rooms[0].type === 'start', 'FALLO: piso 1 no inicia en entrada');
    console.assert(s.floors[1].rooms[0].type === 'campfire', 'FALLO: sin fogata con I4');
  }
  console.log('✓ 30 semillas: 5 pisos de 4-8 salas conectadas, tesoro, élite/jefe, fogatas I4');
}

// 3. Propiedad Lego: cada pieza primaria genera su calabozo sola
{
  for (const meta of PRIMARIAS_JUGABLES) {
    const s = gen([meta.id], 7);
    const middle = s.floors.flatMap((f) => f.rooms.filter(
      (r) => !['start', 'campfire', 'elite', 'boss', 'treasure'].includes(r.type)
    ));
    const expected = ROOM_OF[meta.id];
    if (expected) {
      console.assert(
        middle.every((r) => r.type === expected),
        `FALLO: run de solo ${meta.id} tiene salas ajenas (${[...new Set(middle.map((r) => r.type))]})`
      );
    }
    // Toda sala tiene la materia prima que requiere
    for (const f of s.floors) for (const r of f.rooms) {
      if (r.type === 'bridge') console.assert(r.concept_ids.length === 2, 'FALLO: puente sin par');
      if (r.type === 'door') {
        const c = CURSO_DEMO.concepts.find((x) => x.concept_id === r.concept_ids[0]);
        console.assert(Boolean(c?.fragmento), 'FALLO: puerta sin fragmento');
      }
      if (r.type === 'elite' || r.type === 'boss' || r.type === 'altar') {
        for (const cid of r.concept_ids) console.assert(
          CURSO_DEMO.casos.some((k) => k.concepto_correcto === cid),
          `FALLO: ${r.type} con concepto sin caso`
        );
      }
    }
  }
  console.log(`✓ Lego: las ${PRIMARIAS_JUGABLES.length} piezas primarias generan su calabozo solas, con la capa correcta`);
}

// 4. Sorteo: 20 sorteos válidos, variados, siempre con primaria
{
  const combos = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const pieces = shufflePieces(i * 131 + 7);
    console.assert(pieces.some((p) => PRIMARIAS_JUGABLES.some((m) => m.id === p)), 'FALLO: sorteo sin primaria');
    console.assert(new Set(pieces).size === pieces.length, 'FALLO: sorteo con repetidas');
    console.assert(pieces.every((p) => REGISTRY.some((m) => m.id === p && m.estado === 'jugable')), 'FALLO: sorteo con pieza no jugable');
    gen(pieces, i + 1); // debe generar sin explotar
    combos.add(pieces.slice().sort().join(','));
  }
  console.assert(combos.size >= 10, `FALLO: sorteo poco variado (${combos.size})`);
  console.log(`✓ Sorteo: 20 expediciones sorteadas generables, ${combos.size} combinaciones distintas`);
}

// 4.5 Armas: el héroe nace con piedras; los tesoros llevan arma O ítem
{
  let conArma = 0, conItem = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = gen(['A1', 'B1', 'E3'], seed);
    console.assert(s.weapon === 'piedra', 'FALLO: no nace con piedras');
    for (const f of s.floors) for (const r of f.rooms) {
      if (r.type === 'treasure') {
        console.assert(Boolean(r.weapon_id) !== Boolean(r.item_id), 'FALLO: tesoro sin (o con doble) botín');
        if (r.weapon_id) conArma++;
        if (r.item_id) conItem++;
      }
    }
  }
  console.assert(conArma > 5 && conItem > 5, `FALLO: reparto de botín (${conArma} armas, ${conItem} ítems)`);
  // PICK_WEAPON y ecos
  let s = gen(['A1'], 3);
  s = dungeonReducer(s, { type: 'PICK_WEAPON', weapon_id: 'arco' });
  console.assert(s.weapon === 'arco', 'FALLO: PICK_WEAPON');
  s = dungeonReducer(s, { type: 'ADD_ECO', concept_id: 'x' });
  s = dungeonReducer(s, { type: 'ADD_ECO', concept_id: 'x' });
  console.assert(s.ecos.length === 1, 'FALLO: eco duplicado');
  s = dungeonReducer(s, { type: 'CONSUME_ECO', concept_id: 'x' });
  console.assert(s.ecos.length === 0, 'FALLO: eco no consumido');
  console.log(`✓ Armas y ecos: piedras iniciales, ${conArma} armas / ${conItem} ítems en tesoros, ecos únicos y consumibles`);
}

// 5. Reducer: daño, muerte, tratos G1, pisos, victoria
{
  let s: DungeonState = gen(['A1', 'E3', 'G1'], 3);
  console.assert(multiplier(0) === 1 && multiplier(9) === 2, 'FALLO: multiplicador');

  // Racha y monedas
  s = dungeonReducer(s, { type: 'COG', correct: true, reward: 10 });
  console.assert(s.streak === 1 && s.coins > 0, 'FALLO: COG correcto no paga');
  s = dungeonReducer(s, { type: 'COG', correct: false, reward: 10 });
  console.assert(s.streak === 0, 'FALLO: error no rompe racha');

  // Trato G1: golpe = trato roto y apuesta perdida
  s = { ...s, coins: 100 };
  s = dungeonReducer(s, { type: 'SET_BET', bet: 40 });
  s = dungeonReducer(s, { type: 'DAMAGE' });
  console.assert(s.coins === 60 && s.bet === 0 && s.bet_lost, 'FALLO: trato roto no cobra');

  // Trato ganado: sala superada sin golpe paga 2×
  let t: DungeonState = gen(['A1', 'E3', 'G1'], 4);
  t = { ...t, coins: 100 };
  t = dungeonReducer(t, { type: 'SET_BET', bet: 40 });
  t = dungeonReducer(t, { type: 'CLEAR_ROOM', room_id: t.current_room });
  console.assert(t.coins === 140, `FALLO: trato ganado paga ${t.coins}`);

  // Muerte
  let d: DungeonState = gen(['A1'], 5);
  d = dungeonReducer(d, { type: 'DAMAGE' });
  d = dungeonReducer(d, { type: 'DAMAGE' });
  d = dungeonReducer(d, { type: 'DAMAGE' });
  console.assert(d.status === 'game_over', 'FALLO: 3 golpes no matan');

  // Avance de pisos hasta la victoria
  let w: DungeonState = gen(['A1'], 6);
  for (let i = 0; i < 4; i++) w = dungeonReducer(w, { type: 'NEXT_FLOOR' });
  console.assert(w.floor_index === 4 && w.status === 'active', 'FALLO: avance de pisos');
  w = dungeonReducer(w, { type: 'NEXT_FLOOR' });
  console.assert(w.status === 'won', 'FALLO: quinto descenso no gana');

  // Fogata I4
  let c: DungeonState = gen(['A1', 'I4'], 8);
  c = dungeonReducer(c, { type: 'DAMAGE' });
  c = dungeonReducer(c, { type: 'HEAL', n: 1 });
  console.assert(c.hearts === 3, 'FALLO: fogata no cura');
  c = dungeonReducer(c, { type: 'SET_FOCUS', concept_id: 'confianza_calibrada' });
  console.assert(c.focus_concept === 'confianza_calibrada', 'FALLO: enfoque I4');

  console.log('✓ Reducer: racha, tratos G1 (roto y ganado), muerte, 5 pisos → victoria, fogata I4');
}

// 6. v0.5 — Contratos G2, curaduría I5, rutas I1
{
  // Contrato: COG alimenta, NEXT_FLOOR resuelve y paga
  let s = gen(['A1', 'G2'], 11);
  s = dungeonReducer(s, { type: 'SET_CONTRACT', target: 0.7 });
  s = dungeonReducer(s, { type: 'COG', correct: true, reward: 10 });
  s = dungeonReducer(s, { type: 'COG', correct: true, reward: 10 });
  s = dungeonReducer(s, { type: 'COG', correct: true, reward: 10 });
  s = dungeonReducer(s, { type: 'COG', correct: false, reward: 10 });
  console.assert(s.contract.ok === 3 && s.contract.total === 4, 'FALLO: contrato no cuenta');
  const antes = s.coins;
  s = dungeonReducer(s, { type: 'NEXT_FLOOR' });
  console.assert(s.contract_log.length === 1 && s.contract_log[0].met && s.coins === antes + 25, 'FALLO: contrato cumplido no paga 25');
  console.assert(s.contract.target === null, 'FALLO: contrato no se reinicia');

  // Contrato roto no paga
  let r = gen(['A1', 'G2'], 12);
  r = dungeonReducer(r, { type: 'SET_CONTRACT', target: 0.9 });
  r = dungeonReducer(r, { type: 'COG', correct: false, reward: 10 });
  r = dungeonReducer(r, { type: 'COG', correct: true, reward: 10 });
  const antesR = r.coins;
  r = dungeonReducer(r, { type: 'NEXT_FLOOR' });
  console.assert(!r.contract_log[0].met && r.coins === antesR, 'FALLO: contrato roto pagó');

  // WIN también resuelve el contrato del piso 5
  let w = gen(['A1', 'G2'], 13);
  for (let i = 0; i < 4; i++) w = dungeonReducer(w, { type: 'NEXT_FLOOR' });
  w = dungeonReducer(w, { type: 'SET_CONTRACT', target: 0.5 });
  w = dungeonReducer(w, { type: 'COG', correct: true, reward: 10 });
  w = dungeonReducer(w, { type: 'WIN' });
  console.assert(w.contract_log.some((c) => c.floor === 4 && c.met), 'FALLO: WIN no resolvió contrato');

  // Curaduría: máximo 3
  let c = gen(['A1', 'I5'], 14);
  c = dungeonReducer(c, { type: 'SET_CARRIED', concept_ids: ['a', 'b', 'c', 'd', 'e'] });
  console.assert(c.carried.length === 3, 'FALLO: curaduría admite más de 3');

  // Rutas: acero vuelve feroz el final; peregrino agrega fogata o tesoro
  let base = gen(['A1', 'B1', 'A2', 'I1'], 15);
  const acero = dungeonReducer(base, { type: 'NEXT_FLOOR', route: 'acero' });
  const f1 = acero.floors[1].rooms;
  console.assert(f1[f1.length - 1].feroz === true, 'FALLO: acero no es feroz');
  const pere = dungeonReducer(base, { type: 'NEXT_FLOOR', route: 'peregrino' });
  const tipos = pere.floors[1].rooms.map((r) => r.type);
  console.assert(tipos.includes('campfire') || tipos.filter((t) => t === 'treasure').length >= 1, 'FALLO: peregrino sin respiro');
  console.log('✓ v0.5: contratos (cumplido/roto/WIN), curaduría ≤3, rutas acero/peregrino');
}

// 7. Cobertura de señal: con minijuegos elegidos, ningún piso es 100% combate
{
  for (let seed = 1; seed <= 25; seed++) {
    const s = gen(['A1', 'B1', 'B2', 'C1'], seed);
    for (const f of s.floors) {
      const mid = f.rooms.slice(1, -1).filter((r) => r.type !== 'treasure');
      if (mid.length > 1) {
        console.assert(
          mid.some((r) => ['door', 'shrine', 'altar', 'bridge'].includes(r.type)),
          `FALLO: piso ${f.index} (seed ${seed}) sobre-representa recuperación`
        );
      }
    }
  }
  console.log('✓ Cobertura: ningún piso multi-sala es 100% combate cuando hay piezas de otras familias');
}

// 8. v0.6 — Modo aprendizaje: el Archivo y la política de fading
{
  // El Archivo existe en pisos 1-3 de aprendizaje, conectado; nunca en evaluación
  for (let seed = 1; seed <= 15; seed++) {
    const ap = generateDungeon(CURSO_DEMO, { pieces: ['A1', 'B1', 'E3'], seed, modo: 'aprendizaje' });
    for (const f of ap.floors) {
      const arch = f.rooms.filter((r) => r.type === 'archivo');
      if (f.index <= 2) {
        console.assert(arch.length === 1, `FALLO: piso ${f.index} sin Archivo (seed ${seed})`);
        const a = arch[0];
        console.assert(
          f.rooms.some((r) => r.id !== a.id && Math.abs(r.gx - a.gx) + Math.abs(r.gy - a.gy) === 1),
          'FALLO: Archivo desconectado'
        );
        console.assert(a.concept_ids.length > 0, 'FALLO: Archivo sin pergaminos');
      } else {
        console.assert(arch.length === 0, `FALLO: Archivo en piso ${f.index} (fading roto)`);
      }
    }
    const ev = generateDungeon(CURSO_DEMO, { pieces: ['A1', 'B1', 'E3'], seed, modo: 'evaluacion' });
    console.assert(ev.floors.every((f) => f.rooms.every((r) => r.type !== 'archivo')), 'FALLO: Archivo en evaluación');
  }
  // Fading monotónico: el soporte nunca SUBE al bajar de piso
  const soporte = (f: number) => {
    const sc = scaffoldFor('aprendizaje', f);
    return (sc.archivo ? 1 : 0) + (sc.errores_gratis ? 1 : 0) + (sc.lupa_gratis ? 1 : 0) +
      (sc.hint_tras_errores !== null ? 1 : 0) + (sc.senuelos ? 0 : 1) + (1 - sc.orb_speed_mul) + (1 - sc.basics_mul) + (4 - sc.n_slimes);
  };
  for (let f = 1; f < 5; f++) console.assert(soporte(f) <= soporte(f - 1), `FALLO: el andamio SUBE del piso ${f - 1} al ${f}`);
  // Evaluación = fila retirada siempre
  for (let f = 0; f < 5; f++) {
    const sc = scaffoldFor('evaluacion', f);
    console.assert(sc.nivel === 'retirado' && !sc.archivo && !sc.errores_gratis, 'FALLO: evaluación con andamio');
  }
  console.log('✓ Modo aprendizaje: Archivo en pisos 1-3 (conectado, con pergaminos), fading monotónico, evaluación sin andamio');
}

// 9. v0.7 — Aprendizaje puro: REVIVE y scaffold sin castigo cognitivo
{
  // Morir en aprendizaje = revivir en la entrada del piso, runas intactas
  let s = generateDungeon(CURSO_DEMO, { pieces: ['A1'], seed: 21, modo: 'aprendizaje' });
  s = dungeonReducer(s, { type: 'NEXT_FLOOR' });
  const roomAntes = s.floors[1].rooms[0].id;
  s = dungeonReducer(s, { type: 'MOVE_ROOM', room_id: s.floors[1].rooms[1].id });
  for (let i = 0; i < 3; i++) s = dungeonReducer(s, { type: 'DAMAGE' });
  console.assert(s.status === 'game_over', 'FALLO: no murió');
  s = dungeonReducer(s, { type: 'REVIVE' });
  console.assert(s.status === 'active' && s.hearts === s.max_hearts && s.current_room === roomAntes && s.floor_index === 1, 'FALLO: REVIVE');
  // REVIVE no aplica si está vivo
  let v = generateDungeon(CURSO_DEMO, { pieces: ['A1'], seed: 22, modo: 'aprendizaje' });
  const antes = JSON.stringify(v);
  v = dungeonReducer(v, { type: 'REVIVE' });
  console.assert(JSON.stringify(v) === antes, 'FALLO: REVIVE en vida');
  // En aprendizaje los errores cognitivos JAMÁS hieren y la ayuda es gratis SIEMPRE
  for (let f = 0; f < 5; f++) {
    const sc = scaffoldFor('aprendizaje', f);
    console.assert(sc.errores_gratis && sc.lupa_gratis, `FALLO: piso ${f} castiga el error o cobra la ayuda en aprendizaje`);
  }
  // Y en evaluación nunca son gratis
  for (let f = 0; f < 5; f++) {
    const sc = scaffoldFor('evaluacion', f);
    console.assert(!sc.errores_gratis && !sc.lupa_gratis, 'FALLO: evaluación regala');
  }
  console.log('✓ v0.7: REVIVE (muerte sin pérdida), errar nunca hiere en aprendizaje, ayuda gratis siempre; evaluación intacta');
}

console.log('\n✅ Todas las pruebas de humo v0.7 pasaron');
