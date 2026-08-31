"""tiras.py v4 — prepara packs de la comunidad para El Archivo Infinito.
1) Pega frames sueltos (nombre-00.png…) en tiras horizontales.
2) Detecta hojas YA montadas probando anchos de frame conocidos
   (alto, 90, 100, 45, 48): cubre LuizMelo (cuadrados) y MonoPixelArt (90×64).
3) CASTING por carpeta/criatura: cada enemigo toma clips de UNA sola criatura,
   nunca mezcla packs.
Correr desde la raíz del repo: python tiras.py
"""
import json, re
from pathlib import Path
from PIL import Image

RAIZ = Path('public/art/sprites')
patron = re.compile(r'^(.*?)[-_](\d+)\.png$', re.I)

# ruta relativa (sprites/...) → nº de frames
conteos: dict[str, int] = {}


def registrar(ruta: str, frames: int):
    conteos[ruta] = frames
    print(f'{ruta}  ({frames} frames)')


def frames_de_hoja(w: int, h: int) -> int:
    """Prueba anchos de frame conocidos; 0 si ninguno divide limpio."""
    for fw in (h, 90, 100, 45, 48, 32):
        if fw > 0 and w % fw == 0 and w // fw >= 2:
            return w // fw
    return 0


# packs CC0 cuyas hojas traen a la criatura nadando en aire transparente:
# se recortan al armar la tira (LuizMelo lo permite; MonoPixelArt no se toca)
RECORTAR = ('monsters', 'wizard')


def recortar_pack(carpeta: Path):
    """Por criatura (subcarpeta o carpeta): caja común de todos sus clips,
    recorte de cada frame a esa caja (ancla abajo intacta) y tira nueva."""
    grupos: dict[Path, list[Path]] = {}
    for f in carpeta.rglob('*.png'):
        if 'tiras' in f.parts:
            continue
        with Image.open(f) as im:
            if frames_de_hoja(*im.size):
                grupos.setdefault(f.parent, []).append(f)
    for sub, hojas in grupos.items():
        # 1. caja común de la criatura en TODOS sus frames
        caja = None
        rebanadas: dict[Path, list] = {}
        for f in hojas:
            im = Image.open(f).convert('RGBA')
            n = frames_de_hoja(*im.size)
            fw = im.width // n
            frames = [im.crop((i * fw, 0, (i + 1) * fw, im.height)) for i in range(n)]
            rebanadas[f] = frames
            for fr in frames:
                b = fr.getbbox()
                if not b:
                    continue
                caja = b if caja is None else (
                    min(caja[0], b[0]), min(caja[1], b[1]),
                    max(caja[2], b[2]), max(caja[3], b[3]))
        if caja is None:
            continue
        for f, frames_ in rebanadas.items():
            rec = [fr.crop(caja) for fr in frames_]
            w, h = rec[0].size
            hoja = Image.new('RGBA', (w * len(rec), h), (0, 0, 0, 0))
            for i, fr in enumerate(rec):
                hoja.paste(fr, (i * w, 0))
            slug = f"{sub.name}-{f.stem}".lower().replace(' ', '-')
            destino = carpeta / 'tiras' / f'{slug}.png'
            destino.parent.mkdir(exist_ok=True)
            hoja.save(destino)
            registrar(f'sprites/{carpeta.name}/tiras/{slug}.png', len(rec))


for carpeta in sorted(p for p in RAIZ.iterdir() if p.is_dir()):
    if carpeta.name in RECORTAR:
        recortar_pack(carpeta)
        continue
    grupos: dict[str, list] = {}
    for f in carpeta.rglob('*.png'):
        if 'tiras' in f.parts:
            continue
        m = patron.match(f.name)
        if m and len(m.group(2)) >= 2:  # sufijo -00: frame suelto
            grupos.setdefault(m.group(1).lower(), []).append((int(m.group(2)), f))
        else:
            with Image.open(f) as im:
                w, h = im.size
            n = frames_de_hoja(w, h)
            if n:
                registrar(str(f.relative_to(RAIZ.parent)).replace('\\', '/'), n)
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

# ---------- protagonista (rvros adventurer) ----------
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

# ---------- casting: cada enemigo elige UNA criatura (carpeta o prefijo) ----------
# la clave identifica la CRIATURA por su ruta; los clips salen solo de ella
CASTING = [
    ('copista',   ('skeleton',)),
    ('errata',    ('bat-',)),                # pequeña y rápida: la mancha voladora
    ('rumor',     ('flying eye', 'flying_eye', 'flyingeye')),  # vigila y alcanza de lejos
    ('notaalpie', ('goblin',)),
    ('dogma',     ('mushroom',)),
    ('ortodoxia', ('golem',)),
    ('apocrifo',  ('creature', 'evil')),
    ('eco',       ('ghost', 'specter')),
    ('tratado',   ('wizard', 'bringer', 'boss')),
]
GESTOS = [
    ('quieto', ('idle', 'flight', 'fly', 'sleep')),
    ('avanza', ('run', 'walk', 'move')),
    ('herido', ('hit', 'hurt', 'take')),
    ('cae',    ('death', 'die', 'dead')),
]
usados = set()
for enemigo, claves in CASTING:
    candidatas = sorted(r for r in conteos
                        if 'adventurer' not in r and any(k in r.lower() for k in claves))
    if not candidatas:
        continue
    ficha = {}
    golpes = [r for r in candidatas if 'attack' in r.lower()]
    if golpes:
        ficha['golpea'] = ([{'src': r, 'frames': conteos[r], 'fps': 12} for r in golpes]
                           if len(golpes) > 1
                           else {'src': golpes[0], 'frames': conteos[golpes[0]], 'fps': 12})
    for gesto, kws in GESTOS:
        r = next((x for x in candidatas if any(k in x.lower() for k in kws)), None)
        if r:
            ficha[gesto] = {'src': r, 'frames': conteos[r], 'fps': 8 if gesto == 'quieto' else 10}
            if gesto == 'cae':
                ficha[gesto]['loop'] = False
    if 'quieto' in ficha:
        ficha['volteado'] = True
        # escala visual: compensa el aire transparente típico de cada pack
        r0 = next(iter(candidatas))
        if '/monsters/' in r0: ficha['escala'] = 1.7
        elif '/wizard/' in r0: ficha['escala'] = 2.2
        elif '/golems/' in r0: ficha['escala'] = 1.8   # el tanque SE VE tanque
        elif 'bat-' in r0.lower(): ficha['escala'] = 1.3
        datos[f'enemigos/{enemigo}'] = ficha
        usados.add(enemigo)

mf.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding='utf-8')
TODOS = ['copista', 'errata', 'rumor', 'apocrifo', 'notaalpie', 'dogma', 'eco',
         'cita', 'palimpsesto', 'bibliografia', 'ortodoxia', 'tratado']
print('\nmanifest.json →')
print('  héroe:', list(heroe.keys()) or 'sin cambios')
print('  enemigos con sprite:', sorted(usados) or 'ninguno')
print('  siguen en grabado SVG:', [e for e in TODOS if e not in usados])
