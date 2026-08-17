# Subir v4.2 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4.2/patch42/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4.2/patch42/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 34
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v4.2: primera pasada grafica — cedula visual, cascada y sonido

- identity.ts: la apariencia de cada carta se DERIVA del bundle (cluster -> matiz,
  tipo -> ornamento, carga cognitiva -> textura, umbral -> canto dorado,
  importancia -> sombra). El contenido es infinito, asi que no se ilustra: se genera
- los 8 tipos de relacion tienen 8 tratamientos de linea distintos, incluida
  ondulada para matiza y doble para contrasta
- cascade.ts: el marcador se descubre eslabon por eslabon, con combos encendiendose
  y tono ascendente por escala pentatonica; se puede saltar tocando la cuenta
- sfx.ts: sonido sintetizado con WebAudio, sin ficheros ni licencias, con interruptor
- assets.tsx: ranuras de ilustracion con respaldo automatico en el SVG actual;
  public/art/LEEME.md trae la especificacion y la direccion de arte
- Enemigo.gesto expuesto como data-gesto: es ya la maquina de estados para Rive"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
