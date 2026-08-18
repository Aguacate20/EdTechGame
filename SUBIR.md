# Subir v4.3 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4.3/patch43/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4.3/patch43/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 35
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v4.3: poderes, tinta y El Archivo

- powers.ts: 22 lentes pasivas sobre ejes ortogonales (tipo de relacion,
  herramienta, combos, mano, discriminacion, escalera) para que apilarlas
  siempre sume y nunca sea redundante; 6 sellos activos de un uso por combate
- economy.ts: la tinta como moneda, ganada por afirmar, deducir y detectar
  falsificaciones; El Archivo como nodo de tienda con remesa nueva
- quemar bien ahora da tinta, roba una carta, bonifica el proximo diagrama y
  deja acuse de recibo en pantalla
- estante de poderes siempre visible con las pasivas y los sellos
- el disparo del carril ocurre DESPUES de que termina la cuenta del marcador
- al tocar un feedback, su trazo y sus piezas se resaltan y el resto se atenua
- cada herramienta trae un ejemplo con animales para entenderla sin saber del tema
- texto completo de las cartas largas al pasar el raton, sin abrir panel
- npm run smoke anade un criterio de economia: la tinta alcanza sin sobrar"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.
