"""tiras.py v2 — prepara packs de la comunidad para El Archivo Infinito.
1) Pega frames sueltos (nombre-00.png…) en tiras horizontales.
2) Detecta hojas YA montadas (ancho múltiplo del alto) y las usa tal cual.
3) Mapea al protagonista (carpeta `adventurer`) y hace el CASTING automático
   de enemigos por palabras clave de carpeta/archivo.
Correr desde la raíz del repo: python tiras.py
"""
import json, re
from pathlib import Path
from PIL import Image

RAIZ = Path('public/art/sprites')
patron = re.compile(r'^(.*?)[-_](\d+)\.png$', re.I)

conteos: dict[str, int] = {}

def registrar(ruta: str, frames: int):
    conteos[ruta] = frames
    print(f'{ruta}  ({frames} frames)')

for carpeta in sorted(p for p in RAIZ.iterdir() if p.is_dir()):
    grupos: dict[str, list] = {}
    for f in carpeta.rglob('*.png'):
        if 'tiras' in f.parts:
            continue
        m = patron.match(f.name)
        if m:
            grupos.setdefault(m.group(1).lower(), []).append((int(m.group(2)), f))
        else:
            # ¿hoja ya montada? frames cuadrados en una fila
            with Image.open(f) as im:
                w, h = im.size
            if h > 0 and w % h == 0 and w // h >= 2:
                registrar(str(f.relative_to(RAIZ.parent)).replace('\\', '/'), w // h)
    for base, pares in sorted(grupos.items()):
        frames = [Image.open(p).convert('RGBA') for _, p in sorted(pares)]
        if len(frames) < 2:
            continue
        w = max(i.width for i in frames); h = max(i.height for i in frames)
        hoja = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
        for i, im in enumerate(frames):
            hoja.paste(im, (i * w + (w - im.width) // 2, h - im.height))
        destino = carpeta / 'tiras' / f'{base}.png'
        destino.parent.mkdir(exist_ok=True)
        hoja.save(destino)
        registrar(f'sprites/{carpeta.name}/tiras/{base}.png', len(frames))

# ---------- protagonista ----------
def clip_ruta(ruta: str, fps=10, loop=True):
    n = conteos.get(ruta)
    if not n:
        return None
    d = {'src': ruta, 'frames': n, 'fps': fps}
    if not loop:
        d['loop'] = False
    return d

def clip_adv(base, fps=10, loop=True):
    return clip_ruta(f'sprites/adventurer/tiras/adventurer-{base}.png', fps, loop)

mf = Path('public/art/manifest.json')
datos = json.loads(mf.read_text(encoding='utf-8')) if mf.exists() else {}

heroe = {}
for gesto, c in [('quieto', clip_adv('idle-2', 6) or clip_adv('idle', 6)),
                 ('avanza', clip_adv('run', 10)), ('herido', clip_adv('hurt', 8)),
                 ('cae', clip_adv('die', 8, loop=False)),
                 ('golpea_lluvia', clip_adv('bow', 12)), ('golpea_rayo', clip_adv('cast', 10)),
                 ('golpea_onda', clip_adv('cast', 10)),
                 ('golpea_barrido', clip_adv('slide', 14)),
                 ('golpea_sello', clip_adv('air-attack1', 14) or clip_adv('air-attack-1', 14)),
                 ('golpea_perdigon', clip_adv('attack1', 16))]:
    if c:
        heroe[gesto] = c
ataques = [x for x in (clip_adv('attack1', 12), clip_adv('attack2', 12), clip_adv('attack3', 12)) if x]
if ataques:
    heroe['golpea'] = ataques
if heroe:
    datos['jugador/copista'] = {**heroe, 'volteado': False}

# ---------- casting de enemigos por palabras clave ----------
CASTING = [
    ('copista', ('skeleton', 'esquelet')), ('errata', ('flying', 'eye', 'bat', 'murcielago')),
    ('rumor', ('ghost', 'fantasma', 'specter')), ('apocrifo', ('creature', 'criatura', 'evil')),
    ('notaalpie', ('goblin',)), ('dogma', ('mushroom', 'hongo')),
    ('ortodoxia', ('golem',)),
    ('tratado', ('wizard', 'bringer', 'boss', 'reaper')),
]
GESTOS = [
    ('quieto', ('idle', 'flight', 'fly')), ('avanza', ('run', 'walk', 'move')),
    ('herido', ('hit', 'hurt', 'take')), ('cae', ('death', 'die', 'dead')),
]
usados = set()
for enemigo, claves in CASTING:
    candidatas = [r for r in conteos if 'adventurer' not in r and
                  any(k in r.lower() for k in claves)]
    if not candidatas:
        continue
    ficha = {}
    golpes = sorted(r for r in candidatas if 'attack' in r.lower() or 'ataque' in r.lower())
    if golpes:
        ficha['golpea'] = ([{'src': r, 'frames': conteos[r], 'fps': 12} for r in golpes]
                           if len(golpes) > 1 else {'src': golpes[0], 'frames': conteos[golpes[0]], 'fps': 12})
    for gesto, kws in GESTOS:
        r = next((x for x in sorted(candidatas) if any(k in x.lower() for k in kws)), None)
        if r:
            ficha[gesto] = {'src': r, 'frames': conteos[r], 'fps': 8 if gesto == 'quieto' else 10}
            if gesto == 'cae':
                ficha[gesto]['loop'] = False
    if 'quieto' in ficha:
        ficha['volteado'] = True
        datos[f'enemigos/{enemigo}'] = ficha
        usados.add(enemigo)

mf.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding='utf-8')
print('\nmanifest.json →', 'héroe:', list(heroe.keys()) or 'sin cambios')
print('enemigos mapeados:', sorted(usados) or 'ninguno (¿packs descargados en public/art/sprites/?)')
print('sin sprite aún:', [e for e, _ in CASTING if e not in usados])
