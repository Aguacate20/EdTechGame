"""arte_hojas.py — corta las hojas de enemigos de LudusCog (5 filas: idle, walk, attack, hit,
death, de arriba abajo) en las cinco tiras que el juego lee (una fila por archivo).

Uso, desde la raíz del repo:
    python arte_hojas.py                 # busca <clave>.png o <clave>-sheet.png en public/art/luduscog/<clave>/
    python arte_hojas.py --orden idle,attack,walk,hit,death   # si el artista usó otro orden de filas

Cada fila se recorta por transparencia: los cuadros vacíos del final no cuentan (así una fila
de 6 cuadros y otra de 8 conviven en la misma hoja). Después: npm run arte -- --aplicar
"""
import sys
from pathlib import Path
from PIL import Image

RAIZ = Path('public/art/luduscog')
ORDEN = ['idle', 'walk', 'attack', 'hit', 'death']
if '--orden' in sys.argv:
    ORDEN = sys.argv[sys.argv.index('--orden') + 1].split(',')

def ancho_de_cuadro(w: int, h: int) -> int:
    """cuadros cuadrados si el ancho lo permite; si no, anchos conocidos"""
    for fw in (h, 96, 64, 48, 32, 128):
        if fw > 0 and w % fw == 0 and w // fw >= 1:
            return fw
    return h

def cuadro_vacio(img: Image.Image, x0: int, y0: int, fw: int, fh: int) -> bool:
    return img.crop((x0, y0, x0 + fw, y0 + fh)).getbbox() is None

def cortar(hoja: Path, clave: str) -> None:
    img = Image.open(hoja).convert('RGBA')
    w, h = img.size
    filas = len(ORDEN)
    if h % filas != 0:
        print(f'  ✗ {hoja.name}: el alto ({h}) no se divide entre {filas} filas'); return
    fh = h // filas
    fw = ancho_de_cuadro(w, fh)
    for i, nombre in enumerate(ORDEN):
        y0 = i * fh
        n = w // fw
        while n > 0 and cuadro_vacio(img, (n - 1) * fw, y0, fw, fh):
            n -= 1
        if n == 0:
            print(f'  — {clave}-{nombre}.png: fila vacía, se omite'); continue
        tira = img.crop((0, y0, n * fw, y0 + fh))
        salida = hoja.parent / f'{clave}-{nombre}.png'
        tira.save(salida)
        print(f'  ✓ {salida.name}: {n} cuadros de {fw}×{fh}')

def main() -> None:
    hechas = 0
    for carpeta in sorted(p for p in RAIZ.iterdir() if p.is_dir()):
        clave = carpeta.name
        for cand in (carpeta / f'{clave}.png', carpeta / f'{clave}-sheet.png', carpeta / f'{clave}-hoja.png'):
            if cand.exists():
                print(f'{clave} ← {cand.name}')
                cortar(cand, clave); hechas += 1
                break
    print(f'\n{hechas} hoja(s) cortada(s). Ahora: npm run arte -- --aplicar')

if __name__ == '__main__':
    main()
