'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGISTRY, PRIMARIAS_JUGABLES, type MechanicMeta } from '@/game-core/registry';
import { shufflePieces } from '@/game-core/dungeon';

// Menú constructor: cada pieza del catálogo es un VERBO del calabozo.
// Elegir piezas = decidir qué sistemas existen en la expedición.
const FAMILIAS = ['Recuperación', 'Discriminación', 'Relación', 'Estructura', 'Transferencia', 'Producción', 'Calibración', 'Regulación'];

export default function Home() {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(['A1', 'B1', 'E3', 'G1', 'I4']);
  const [seed, setSeed] = useState('');
  const [modo, setModo] = useState<'aprendizaje' | 'evaluacion'>('aprendizaje');

  const jugables = useMemo(() => REGISTRY.filter((m) => m.estado === 'jugable'), []);
  const taller = useMemo(() => REGISTRY.filter((m) => m.estado !== 'jugable'), []);
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const hayPrimaria = sel.some((id) => PRIMARIAS_JUGABLES.some((m) => m.id === id));

  const jugar = () => {
    const q = new URLSearchParams({ m: sel.join(','), modo });
    if (seed.trim()) q.set('seed', seed.trim());
    router.push(`/play?${q.toString()}`);
  };
  const sortear = () => setSel(shufflePieces());

  const Card = ({ m, disabled }: { m: MechanicMeta; disabled?: boolean }) => (
    <button
      className={`piece ${sel.includes(m.id) ? 'on' : ''} ${disabled ? 'locked' : ''}`}
      onClick={() => !disabled && toggle(m.id)}
      title={m.rol}
    >
      <span className="piece-icon">{m.icono}</span>
      <span className="piece-id">{m.id}</span>
      <span className="piece-name">{m.nombre}</span>
      <span className="piece-rol">{m.rol}</span>
      {m.estado === 'requiere_juez' && <span className="piece-tag">requiere Juez</span>}
      {m.estado === 'taller' && <span className="piece-tag">en el taller</span>}
    </button>
  );

  return (
    <div className="game menu">
      <header className="menu-head">
        <h1>⚔ La Expedición</h1>
        <p className="menu-sub">
          Cinco mazmorras. Cada pieza del catálogo añade un <em>verbo</em> al
          calabozo — una forma distinta de jugar tu conocimiento.
        </p>
      </header>

      <section className="builder">
        <div className="mode-picker">
          <button className={`mode-btn ${modo === 'aprendizaje' ? 'on' : ''}`} onClick={() => setModo('aprendizaje')}>
            <span className="mode-title">🪜 Aprender</span>
            <span className="mode-desc">El Archivo te muestra los pergaminos antes de cazarlos. El andamio se retira piso a piso: llegas al jefe sin ayuda, pero preparado. Errar enseña y re-encola.</span>
          </button>
          <button className={`mode-btn ${modo === 'evaluacion' ? 'on' : ''}`} onClick={() => setModo('evaluacion')}>
            <span className="mode-title">⚔ Evaluar</span>
            <span className="mode-desc">Sin andamios desde la entrada: señal limpia, apuestas, contratos y calibración. La fricción es la mecánica.</span>
          </button>
        </div>
        <div className="builder-bar">
          <button className="btn-primary" onClick={jugar} disabled={!hayPrimaria}>
            ⛏ Descender ({sel.length} piezas)
          </button>
          <button className="btn-primary alt" onClick={sortear}>🎲 Sorteo</button>
          <input
            className="seed-input"
            placeholder="semilla (opcional)"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </div>
        {!hayPrimaria && (
          <p className="mech-hint">Elige al menos una pieza primaria (A/B/C/E) — sin verbos no hay calabozo.</p>
        )}

        {FAMILIAS.map((fam) => {
          const js = jugables.filter((m) => m.familia === fam);
          if (!js.length) return null;
          return (
            <div key={fam} className="familia">
              <h2 className="familia-title">{fam}</h2>
              <div className="familia-grid">
                {js.map((m) => <Card key={m.id} m={m} />)}
              </div>
            </div>
          );
        })}

        <details className="taller">
          <summary>🛠 En el taller — {taller.length} piezas mapeadas, en camino</summary>
          <div className="familia-grid">
            {taller.map((m) => <Card key={m.id} m={m} disabled />)}
          </div>
        </details>
      </section>

      <footer className="menu-foot">
        <p>WASD / flechas para moverte · click para disparar · toca los altares para activarlos</p>
      </footer>
    </div>
  );
}
