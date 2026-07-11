'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Crawler } from '@/theme/crawler/Crawler';
import type { DungeonConfig } from '@/game-core/dungeon';

function PlayInner() {
  const params = useSearchParams();
  const pieces = (params.get('m') ?? 'A1,B1,E3').split(',').filter(Boolean);
  const seedRaw = params.get('seed');
  const modoRaw = params.get('modo');
  const config: DungeonConfig = {
    pieces,
    seed: seedRaw ? Math.abs(hashOrInt(seedRaw)) : undefined,
    modo: modoRaw === 'aprendizaje' ? 'aprendizaje' : 'evaluacion',
  };
  return (
    <div className="play-lock">
      <Crawler config={config} />
    </div>
  );
}

function hashOrInt(s: string): number {
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return n;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="game"><p>Encendiendo antorchas…</p></div>}>
      <PlayInner />
    </Suspense>
  );
}
