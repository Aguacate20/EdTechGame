'use client';

// Sprites pixel art dibujados con box-shadow (sin assets externos).
// Cada sprite es una matriz de caracteres; cada carácter mapea a un color.

export function PixelSprite({
  grid,
  palette,
  px = 5,
  className = '',
}: {
  grid: string[];
  palette: Record<string, string>;
  px?: number;
  className?: string;
}) {
  const shadows: string[] = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && palette[ch]) {
        shadows.push(`${x * px}px ${y * px}px 0 0 ${palette[ch]}`);
      }
    });
  });
  const w = grid[0].length * px;
  const h = grid.length * px;
  return (
    <div className={`sprite-box ${className}`} style={{ width: w, height: h }}>
      <div
        style={{
          width: px,
          height: px,
          boxShadow: shadows.join(','),
          marginLeft: -px,
          marginTop: -px,
          transform: `translate(${px}px, ${px}px)`,
        }}
      />
    </div>
  );
}

// ---------- Héroe ----------
const HERO_GRID = [
  '...hhhh...',
  '..hhhhhh..',
  '..hffeff..',
  '..hffff...',
  '...ffff...',
  '.caaaaaac.',
  'c.aaaaaa.c',
  '..aaaaaa..',
  '..aa..aa..',
  '..bb..bb..',
];
const HERO_PAL = {
  h: '#f5a742', // yelmo con luz de antorcha
  f: '#e8b88a',
  e: '#1b1529',
  a: '#5a7bd8', // armadura
  c: '#3b4b8f', // brazos/capa
  b: '#3b2f2f',
};
export const Hero = ({ px = 5 }: { px?: number }) => (
  <PixelSprite grid={HERO_GRID} palette={HERO_PAL} px={px} className="hero-sprite" />
);

// ---------- Slime (color parametrizable) ----------
const SLIME_GRID = [
  '..gggg..',
  '.gggggg.',
  '.geggeg.',
  'gggggggg',
  'gggggggg',
  '.g.gg.g.',
];
export const Slime = ({ color, px = 5 }: { color: string; px?: number }) => (
  <PixelSprite
    grid={SLIME_GRID}
    palette={{ g: color, e: '#14101f' }}
    px={px}
    className="slime-sprite"
  />
);
export const SLIME_COLORS = ['#6fd66a', '#5ab8d8', '#b96be0', '#f0c245', '#e8845f', '#8a9ba8'];

// ---------- Demonio (jefe / enemigo de caso) ----------
const DEMON_GRID = [
  'r...rr...r',
  'rr..rr..rr',
  '.rrrrrrrr.',
  '.ryrrrryr.',
  '.rrrrrrrr.',
  '.rrwwwwrr.',
  '..rrrrrr..',
  '..r.rr.r..',
  '.rr....rr.',
];
const DEMON_PAL = { r: '#c73e4a', y: '#f0c245', w: '#ece4d0' };
export const Demon = ({ px = 6 }: { px?: number }) => (
  <PixelSprite grid={DEMON_GRID} palette={DEMON_PAL} px={px} className="demon-sprite" />
);
