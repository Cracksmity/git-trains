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
npm run zoom -- 0 0 224 100 --no-trains   # recorte ampliado de la escena en los dos temas, en sample/
```

Lee [CONTRIBUTING.md](../../CONTRIBUTING.md) para agregar un modelo, un skyline o lo que sea.
## Pintar escenarios a mano

Los escenarios pintados a mano, como `jalisco`, dibujan cada monumento píxel por píxel en `src/landscape/`, con las tintas de su archivo de paleta. Estas notas salen de dibujar Guadalajara, Los Altos y Tequila. El caso completo, del primer boceto al README del perfil, está en las [lecciones de diseño y publicación de Jalisco](jalisco-lecciones.md).

- **Dibuja a partir de fotos.** Un monumento se reconoce por uno o dos rasgos característicos, no por el detalle. En la Catedral son el arco curvo de la fachada y las agujas amarillas con aristas azules; en el Estadio Jalisco, el techo blanco plano con armaduras pequeñas. De memoria, el monumento suele salir como un edificio genérico.
- **Cada parte se apoya en la de abajo.** Una cúpula necesita su tambor, el tambor su base y un remate su balaustrada. Pinta primero lo que va detrás y deja que la pieza del frente tape la unión: el Sagrario va antes que la torre de la Catedral, y los bogies del tren ligero antes que la carrocería.
- **Los detalles nocturnos son tintas.** Una tinta cuyo valor claro es igual al fondo solo se ve en el tema oscuro. Así funcionan las estrellas del campo, las ventanas encendidas de las torres y el letrero del hotel, sin capas extra.
- **Adapta las ruedas y los contornos al vehículo.** Un contorno casi negro desaparece en un vagón oscuro, pero en uno claro parece entintado. Los vagones de carga van sobre trucks, no sobre bogies de pasajeros.
- **Revisa los dos temas, de cerca y a tamaño README.** `npm run zoom -- x0 y0 x1 y1` escribe `<out>-light.png` y `<out>-dark.png`. Las coordenadas son píxeles de la escena: 448 de ancho, con el primer riel en la fila 88 y cada vía siguiente 52 filas más abajo. Agrega `--no-trains` para ver todo el fondo, `--scale` para cambiar la ampliación (6 por defecto), `--time` para avanzar la animación y `--weather` (`rain`, o `storm,rain,cloudy`) para dibujar el clima de Jalisco. Revisa también el cuadro 0, que es el que muestra el PNG fijo: ahí un tren puede tapar la parte baja del fondo.
## Créditos

La idea de convertir la actividad en una imagen viva viene de [git-koi](https://github.com/yalongwastaken/git-koi). Los trenes toman de las fotos de los reales solo el color y la forma; no se reproducen logotipos ni rótulos.
## Licencia

[MIT](../../LICENSE).
