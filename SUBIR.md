# Subir v5.8 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.8/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.8/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 43
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.8: el modo Aprendizaje pasa a ser fragmentado y con andamio que se retira

- una sala son tres oleadas cortas: reconocer, relacionar, sostener. Cada una
  anade conceptos y una herramienta, y quita una ayuda
- el andamio se retira en orden y anunciandolo: total, parcial, ninguno. En la
  ultima oleada la lucidez ya baja
- no se avanza acumulando sino reusando: si el diagrama no toca nada de las
  oleadas anteriores, rinde la mitad
- los pares fallados vuelven en la oleada siguiente
- el nudo: si el concepto puerta sigue sin evidencia, la sala no se cierra aunque
  el carril este vacio
- el Vistazo antes de cada sala, con pregunta abierta y apuesta de leerlo o saltarlo
- rutas mas cortas en aprendizaje (10 salas en vez de 16)
- el cierre del tutorial estaba duplicado; la guia se aparta cuando tapa el foco
- Con andamio pasa a llamarse Modo aprendizaje"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
