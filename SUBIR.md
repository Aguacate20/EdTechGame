# Subir v5.0 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.0/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.0/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 38
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.0: fase de prevision, organizador previo y coexistencia de repertorios

Aprendizaje significativo revisitado (Bryce y Blown) + autorregulacion (Zimmerman,
Littlejohn, Reparaz) sin tocar la dinamica de combate.

- antesala antes de cada oleada: organizador previo (concepto mas inclusivo con lo
  que ya sabes de el), prediccion de un toque y desafio opcional autoimpuesto
- encargo de expedicion: meta comprobable elegida al empezar, visible en la barra
- dominios de aplicacion en cada nodo y minutos estimados; reflexion de cierre de
  acto eligiendo dominio, sin escritura
- la intuicion reubicada YA NO se borra: vuelve como carta de Terreno. El cambio
  conceptual es coexistencia y seleccion, no reemplazo
- las apocrifas salen de distractor_pools con su concepto_confundido y su
  explicacion, en vez de fabricarse por vecindad del grafo
- el nivel del Atlas exige vecindades distintas ademas de herramientas distintas
- latencia real, separada por si habia una intuicion compitiendo con el concepto
- curva propia en el mapa de cierre y contraste de la prediccion"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
