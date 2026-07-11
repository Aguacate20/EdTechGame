'use client';

import type { DFloor, RoomType } from '@/game-core/dungeon';

const ICON: Record<RoomType, string> = {
  start: '◦', archivo: '📚', campfire: '🔥', hunt: '🏹', specter: '👻', door: '🚪',
  shrine: '🗿', altar: '⚗', bridge: '🌉', treasure: '▣', elite: '💀', boss: '☠',
};

// Minimapa estilo Isaac: solo salas visitadas + siluetas de las adyacentes.
export function Minimap({ floor, currentId }: { floor: DFloor; currentId: string }) {
  const xs = floor.rooms.map((r) => r.gx);
  const ys = floor.rooms.map((r) => r.gy);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const visitedKeys = new Set(floor.rooms.filter((r) => r.visited).map((r) => `${r.gx},${r.gy}`));
  const adj = (gx: number, gy: number) =>
    visitedKeys.has(`${gx + 1},${gy}`) || visitedKeys.has(`${gx - 1},${gy}`) ||
    visitedKeys.has(`${gx},${gy + 1}`) || visitedKeys.has(`${gx},${gy - 1}`);

  return (
    <div className="minimap" aria-label="minimapa de la mazmorra">
      {floor.rooms.map((r) => {
        const known = r.visited || adj(r.gx, r.gy);
        if (!known) return null;
        return (
          <div
            key={r.id}
            className={`mm-cell ${r.visited ? 'seen' : 'ghost'} ${r.id === currentId ? 'here' : ''} ${r.cleared ? 'clear' : ''}`}
            style={{ gridColumn: r.gx - minX + 1, gridRow: r.gy - minY + 1 }}
          >
            {r.visited ? ICON[r.type] : '?'}
          </div>
        );
      })}
    </div>
  );
}
