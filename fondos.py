"""fondos.py — compone las capas de parallax de ansimuz en UN solo PNG por acto.

El juego pide `public/art/fondos/actoN.png`; los packs traen capas sueltas
(`actoN_back.png`, `actoN_middle.png`…). Este script apila cada capa, en orden
de fondo a frente, repitiéndola horizontalmente hasta llenar el lienzo y
anclándola abajo. Los tilesets y hojas de props se saltan (son piezas de
editor, no fondo).

Nombra tus capas `actoN_<capa>.png` (ya lo hiciste) y corre:
    python fondos.py
"""
from pathlib import Path
from PIL import Image

CARPETA = Path('public/art/fondos')
ANCHO = 1600
# orden de fondo→frente; lo que no esté aquí y no sea tile/prop va al final
ORDEN = ['back', 'far', 'sky', 'mountains', 'middle', 'near', 'front', 'foreground']
SALTAR = ('tile', 'tiles', 'tileset', 'props', 'prop')


def capa_orden(nombre: str) -> int:
    for i, k in enumerate(ORDEN):
        if k in nombre:
            return i
    return len(ORDEN)


for acto in (1, 2, 3):
    capas = sorted(
        (p for p in CARPETA.glob(f'acto{acto}_*.png')
         if not any(s in p.stem.lower() for s in SALTAR)),
        key=lambda p: capa_orden(p.stem.lower()))
    if not capas:
        continue
    alto = max(Image.open(p).height for p in capas)
    lienzo = Image.new('RGBA', (ANCHO, alto), (19, 26, 36, 255))
    for p in capas:
        im = Image.open(p).convert('RGBA')
        y = alto - im.height  # ancladas abajo
        for x in range(0, ANCHO, im.width):
            lienzo.alpha_composite(im, (x, y))
    salida = CARPETA / f'acto{acto}.png'
    lienzo.save(salida)
    print(f'{salida}  ← {", ".join(p.stem for p in capas)}  ({ANCHO}×{alto})')

print('\nListo. Si quieres fondos por tipo de sala, copia y ajusta:')
print('  cp public/art/fondos/acto3.png public/art/fondos/jefe_acto3.png')
