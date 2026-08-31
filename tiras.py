import json, re
from pathlib import Path
from PIL import Image

RAIZ = Path('public/art/sprites')
patron = re.compile(r'^(.*?)[-_](\d+)\.png$', re.I)

conteos = {}
for carpeta in sorted(p for p in RAIZ.iterdir() if p.is_dir()):
    grupos = {}
    for f in carpeta.rglob('*.png'):            # ← recursivo
        if 'tiras' in f.parts:
            continue
        m = patron.match(f.name)
        if m:
            grupos.setdefault(m.group(1).lower(), []).append((int(m.group(2)), f))
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
        ruta = f'sprites/{carpeta.name}/tiras/{base}.png'
        conteos[ruta] = len(frames)
        print(f'{ruta}  ({len(frames)} frames)')

def clip(base, fps=10, loop=True):
    ruta = f'sprites/adventurer/tiras/adventurer-{base}.png'
    if ruta not in conteos:
        return None
    d = {'src': ruta, 'frames': conteos[ruta], 'fps': fps}
    if not loop:
        d['loop'] = False
    return d

ficha = {}
for gesto, c in [('quieto', clip('idle-2', 6) or clip('idle', 6)),
                 ('avanza', clip('run', 10)),
                 ('herido', clip('hurt', 8)),
                 ('cae', clip('die', 8, loop=False)),
                 ('golpea_lluvia', clip('bow', 12)),
                 ('golpea_rayo', clip('cast', 10))]:
    if c:
        ficha[gesto] = c
ataques = [c for c in (clip('attack1', 12), clip('attack2', 12), clip('attack3', 12)) if c]
if ataques:
    ficha['golpea'] = ataques

mf = Path('public/art/manifest.json')
datos = json.loads(mf.read_text(encoding='utf-8')) if mf.exists() else {}
datos['jugador/copista'] = ficha
mf.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding='utf-8')
print('\njugador/copista →', list(ficha.keys()))
if 'quieto' not in ficha:
    print('OJO: sigue sin idle — el zip no trae esos frames; pégame el listado de tiras de arriba')
