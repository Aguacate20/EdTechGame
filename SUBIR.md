# Subir v5.7 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.7/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.7/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 41
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.7: tutorial con foco visual, tercera sala y cierre

- los pasos de la guia son monotonos: afirmar limpia el tablero y la condicion del
  primer paso volvia a ser falsa, asi que la guia se reiniciaba sola. Corregido
- pistas visuales tipicas de tutorial: se oscurece el resto de la pantalla, la zona
  que toca queda iluminada, lo que hay que tocar late con flecha que apunta, y lo
  demas no se puede arrastrar ni pulsar
- tercera sala con la Lente del arquitecto regalada y una mano preparada para que
  el combo salga grande, contra un Dogma que exige cadenas
- pantalla de cierre que invita a jugar con el texto propio
- textos de los pasos reescritos para que no se repitan entre salas"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
