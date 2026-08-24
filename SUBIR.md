# Subir v5.6 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.6/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.6/patch50/edtech-game"

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
git commit -m "v5.6: tutorial guiado de dos combates y conmutable desde el menu

- dos salas prefabricadas con mano fija y frente fijo: la primera ensena a poner
  piezas, emparejar con la Identidad y afirmar; la segunda a encadenar flechas,
  detectar una falsificacion y recoger la mejora
- panel de guia con pasos que avanzan por condicion real sobre el estado de la
  partida, no por tiempo
- el tutorial se activa y se desactiva sin perder el texto cargado: al salir se
  recupera con su Atlas y su expedicion a medias
- iniciarBatalla acepta mazo y enemigos fijos, para poder guionizar salas"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
