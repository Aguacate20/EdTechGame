# Subir el patch al repositorio

El repositorio `Aguacate20/EdTechGame` contenía el explorador de mazmorras anterior.
Esta versión lo sustituye por completo, así que el paso 1 borra el contenido viejo
y conserva el historial (nada se pierde: sigue en los commits anteriores).

Ruta del zip descomprimido: `C:/Users/sebas/Downloads/edtech_v3.3_a3/patch33`

```bash
cd /c/Proyectos/edtech-game

# 0. red de seguridad: una rama con el estado actual, por si acaso
git checkout -b respaldo-dungeon-crawler
git push -u origin respaldo-dungeon-crawler
git checkout main

# 1. vaciar el árbol de trabajo conservando .git
git rm -r --cached . > /dev/null
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# 2. copiar el patch
cp -r /c/Users/sebas/Downloads/edtech_v3.3_a3/patch33/edtech-game/. .

# 3. comprobar que compila y que el bot tramposo pierde
npm install
npm run typecheck
npm run smoke
npm run build

# 4. commit
git add -A
git commit -m "v3.3: roguelike deckbuilder cognitivo sobre el bundle del extractor

Sustituye el explorador de mazmorras. El juego consume bundle.json como
materia prima: ruta desde study_plan, condiciones desde carga_cognitiva,
EL ECO desde repertoires, jefe desde theses y Atlas persistente.

- separa mazo de contenido (currículo) de mazo de operaciones (jugador)
- la build modula recompensa, nunca corrección
- el dano se calcula despues de resolver y nunca se imprime en la carta
- B1 se juega como atribucion, no como verdadero/falso
- npm run smoke verifica que un bot de heuristica fija pierde siempre"

git push origin main
```

## Si prefieres no borrar y empezar en una rama limpia

```bash
cd /c/Proyectos/edtech-game
git checkout --orphan v3
git rm -rf . > /dev/null
cp -r /c/Users/sebas/Downloads/edtech_v3.3_a3/patch33/edtech-game/. .
npm install && npm run smoke
git add -A
git commit -m "v3.3: roguelike deckbuilder cognitivo"
git push -u origin v3
```

## Desplegar en Vercel

Es un proyecto Vite estático, sin variables de entorno.

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Si el backend de Hugging Face rechaza al navegador por CORS, el juego lo dice en
pantalla y siempre queda la opción de subir el `bundle.json` a mano.

## Recordatorio de los dos remotes

HuggingFace Space y GitHub son remotes distintos y necesitan `push` por separado.
Este repositorio es solo GitHub; el backend del extractor va aparte.
