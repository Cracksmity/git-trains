# Desarrollo y créditos

[git-trains](../../README.es.md)

## Hecho con un director de IAs

Este proyecto lo construye una IA que dirige a otras. [tools/conductor](../../tools/conductor) le pasa cada tarea a Codex o a Antigravity (Gemini) según su tipo, la corre en un worktree de git aislado, revisa el resultado con filtros (tests, el validador, enlaces, traducción), le devuelve los fallos y sube a un modelo más fuerte cuando uno sigue fallando. El reparto sale de la [comparativa de Medellín](https://cracksmity.github.io/git-trains/benchmarks/medellin/), donde diez corridas de IA diseñaron el mismo tren y skyline. Cada intento queda registrado, y la [tabla de posiciones de las IAs](https://cracksmity.github.io/git-trains/leaderboard/) muestra qué modelo hizo qué tarea: cuántas veces pasó a la primera, cuánto tardó y cuántos tokens usó.
## Desarrollo

```bash
npm run preview    # playground en http://localhost:4173 (controles en vivo)
npm run sample     # escribe SVG con datos de muestra en ./sample
npm test           # tests
npm run docs       # regenera los SVG de docs/
npm run community  # revisa community/ y regenera community/index.json para la galería
npm run leaderboard # une los registros del conductor en docs/leaderboard.json para la tabla de posiciones
node scripts/sheet.js sheet.png 5 3 0                                # hoja PNG ampliada de todos los modelos
node scripts/sheet.js mine.png 5 2 0 examples/trains/new-york.json   # ...o de un tren en JSON
```

Lee [CONTRIBUTING.md](../../CONTRIBUTING.md) para agregar un modelo, un skyline o lo que sea.
## Créditos

La idea de convertir la actividad en una imagen viva viene de [git-koi](https://github.com/yalongwastaken/git-koi). Los trenes toman de las fotos de los reales solo el color y la forma; no se reproducen logotipos ni rótulos.
## Licencia

[MIT](../../LICENSE).
