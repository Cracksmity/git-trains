# git-trains

[English](README.md) · **Español**

[![CI](https://github.com/Cracksmity/git-trains/actions/workflows/ci.yml/badge.svg)](https://github.com/Cracksmity/git-trains/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

Tu actividad en GitHub convertida en un **tren en pixel art**: crece con tus contribuciones, lleva el color de tu lenguaje principal y corre tan rápido como trabajaste ayer. Una GitHub Action lo escribe como SVG animado para el README de tu perfil, todos los días y sin servicios externos.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-dark.svg">
  <img alt="El tren del autor hoy, dibujado por el workflow de este repositorio" src="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-light.svg">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-calendar-dark.svg">
  <img alt="El calendario de contribuciones del autor hoy, recorrido por el mismo tren" src="https://raw.githubusercontent.com/Cracksmity/git-trains/output/train-calendar-light.svg">
</picture>

<sub>Ese es el tren del autor hoy, con su [calendario](#modo-calendario); [el workflow de este repo](.github/workflows/train.yml) lo vuelve a dibujar cada mañana. Prueba todas las opciones en el **[playground](https://cracksmity.github.io/git-trains/preview/)**.</sub>

## Qué significa cada parte

| Tu actividad | En el tren |
| --- | --- |
| Contribuciones del último año | **Vagones**, de 1 a 6 (50 / 200 / 500 / 1000 / 2000) |
| Lenguaje principal | Una **franja** con el color oficial de ese lenguaje en GitHub |
| Racha actual | El letrero LED **"RACHA 12"** (con `language: es`) y las ventanas encendidas (30 días las prenden todas) |
| Lo que hiciste ayer | **0**: parado con las puertas abiertas · **1-3**: lento · **4-9**: normal · **10+**: rápido, con chispas y líneas de velocidad |
| Esa misma actividad | Un **semáforo** junto a la vía: rojo (0), ámbar (poca) o verde (normal o mucha) |
| Tu usuario | El **letrero de la estación** y una **ciudad propia** generada a partir de tu nombre: no hay dos iguales |

Tu racha no se rompe a primera hora: si hoy todavía no hay actividad, cuenta desde ayer.

## Modo calendario

Con `calendar: true` la Action también escribe un calendario de contribuciones junto al tren. Una versión mini de tu tren recorre las semanas en zigzag, come las celdas con contribuciones y crece hasta tener el mismo largo que el tren de la escena. También funciona con trenes propios y de vapor. La franja, las ventanas y la velocidad siguen tu actividad; el texto muestra tus contribuciones y tu racha. También se aplican `language` y `label`. El calendario sigue el tema elegido y deja el tren estacionado si se prefiere reducir el movimiento.

![Calendario de contribuciones con un metro blanco](docs/example-calendar.svg)

```yaml
      - uses: Cracksmity/git-trains@v1
        with:
          calendar: true
```

Con `theme: both` (el valor por defecto), agrega esto a tu README:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="dist/train-calendar-dark.svg">
  <img alt="Mi calendario de contribuciones y mi tren" src="dist/train-calendar-light.svg">
</picture>
```

La Action también escribe `train-calendar.svg`. Con un solo tema, escribe únicamente ese archivo de calendario. Mira también el [ejemplo de vapor](docs/example-calendar-steam.svg).

## Estaciones y fiestas

La escena sigue el calendario, así que tu perfil se siente vivo todo el año. El día que corre la Action (UTC) añade unos pocos píxeles de decoración en capas propias, detrás del tren, y también se detiene si se prefiere reducir el movimiento:

| Cuándo | Qué lleva la escena |
| --- | --- |
| Invierno (dic – feb) | nieve ligera cayendo, nieve en los techos y en el suelo |
| Primavera (mar – may) | unos pétalos rosas a la deriva |
| Verano (jun – ago) | nada: la escena de siempre |
| Otoño (sep – nov) | hojas naranjas |
| 1 – 30 oct · Hacktoberfest | una calabaza pequeña junto al semáforo |
| 31 oct – 2 nov · Día de Muertos | papel picado color cempasúchil colgado a lo largo de la vía |
| 15 dic – 6 ene · Navidad | luces parpadeantes en el cable |
| 31 dic – 1 ene · Año Nuevo | fuegos artificiales detrás de la ciudad |

| | |
| --- | --- |
| <img alt="La escena del tren con nieve cayendo y nieve en los techos" src="docs/example-winter.svg"><br><sub>Invierno (20 ene)</sub> | <img alt="La escena del tren con pétalos rosas a la deriva" src="docs/example-spring.svg"><br><sub>Primavera (10 abr)</sub> |
| <img alt="La escena del tren con papel picado de cempasúchil a lo largo del cable" src="docs/example-muertos.svg"><br><sub>Día de Muertos (1 nov)</sub> | <img alt="La escena del tren con luces parpadeantes en el cable" src="docs/example-christmas.svg"><br><sub>Navidad (20 dic)</sub> |

Una fiesta gana a la estación, y cuando dos fiestas se solapan gana la más corta (Año Nuevo sobre Navidad, Día de Muertos sobre Hacktoberfest). Las estaciones son las del hemisferio norte: con `hemisphere: south` se invierten (la primavera empieza en septiembre; las fiestas conservan sus fechas), y con `seasons: false` la escena queda sin adornos todo el año. Un día sin decoración dibuja exactamente el mismo SVG de antes.

Para ver cualquier día, usa el selector de fecha del **[playground](https://cracksmity.github.io/git-trains/preview/)**. En código, `buildSpec(stats, { date: '2026-12-24', hemisphere: 'north' })` viste la escena para ese día (`date` es un `Date` o un texto `YYYY-MM-DD`).

## Uso rápido

Crea `.github/workflows/train.yml` en tu repositorio de perfil (el que se llama igual que tu usuario):

```yaml
name: GitHub train
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
permissions:
  contents: write
jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Cracksmity/git-trains@v1
        with:
          language: es # el letrero dice RACHA en vez de STREAK
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add dist
          git diff --cached --quiet || (git commit -m "chore: update train" && git push)
```

Luego agrega esto a tu `README.md` para que siga el tema claro u oscuro de GitHub:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="dist/train-dark.svg">
  <img alt="Mi tren de GitHub" src="dist/train-light.svg">
</picture>
```

Corre el workflow una vez desde la pestaña Actions y el tren aparece. Hay un ejemplo completo, con todas las opciones comentadas, en [examples/workflow.yml](examples/workflow.yml).

## Opciones

| Input | Por defecto | Qué hace |
| --- | --- | --- |
| `train` | `auto` | `auto` evoluciona con tus vagones; o elige un [modelo](#modelos); o la ruta a [tu propio tren](#haz-tu-propio-tren-a-mano-o-con-ia) en JSON |
| `skyline` | `city` | `city` (generada y única para ti), `new-york`, `osaka` o la ruta a [tu propio skyline](#skylines-de-ciudades) en JSON |
| `mode` | `single` | `single`: un tren con tu lenguaje principal · `multi`: 3 vías, un tren por lenguaje, en sentidos opuestos |
| `calendar` | `false` | `true` tambi?n escribe el calendario de contribuciones animado (ver arriba) |
| `seasons` | `true` | `true` viste la escena con la estación o la fiesta del día en que corre; `false` la deja sin adornos (ver [Estaciones y fiestas](#estaciones-y-fiestas)) |
| `hemisphere` | `north` | `north` o `south`: qué hemisferio siguen las estaciones. Las fiestas conservan sus fechas |
| `theme` | `both` | `both` escribe `train-light.svg`, `train-dark.svg` y `train.svg` (automático); o `light`, `dark`, `auto` |
| `language` | `en` | `en` o `es`: la palabra del letrero (`STREAK` / `RACHA`), el título de la imagen y los textos de las tarjetas |
| `label` | según `language` | Palabra del letrero LED (tiene prioridad sobre `language`) |
| `exclude-languages` | | Lenguajes a dejar fuera, separados por comas, por ejemplo `HTML, Jupyter Notebook` |
| `scale` | `2` | Tamaño de cada píxel (1 a 6) |
| `user` | dueño del repo | Usuario a dibujar |
| `github-token` | `github.token` | Usa un PAT para contar contribuciones privadas |
| `output-dir` | `dist` | Carpeta de salida |
| `cards` | `none` | Tarjetas de perfil: `stats`, `languages` o `both` (ver abajo) |
| `rank` | `letter` | Centro del anillo de la tarjeta de estadísticas: `letter` (S, A+, B...) o `github` (el logo) |
| `border` | `true` | Borde de las tarjetas |
| `max-languages` | `6` | Lenguajes en la tarjeta de lenguajes (1 a 10) |
| `color-background`, `color-title`, `color-icon`, `color-text`, `color-ring` | GitHub oscuro | Colores de las tarjetas, hexadecimal sin `#` |

Salidas: `files`, `cars`, `streak`, `state`, `model`.

> ¿Vienes de 0.x? Los nombres en español (`tren`, `fondo`, `modo`, `tema`, `idioma`...) y los ids anteriores (`tranvia`, `metro-blanco`, `bala`...) siguen funcionando y dejan un aviso en el log. Los archivos de salida ahora son `train-*.svg` y `card-*.svg`: actualiza las rutas en tu README. Detalles en el [changelog](CHANGELOG.md).

## Modelos

| id | Inspirado en | Alimentación |
| --- | --- | --- |
| `tram` | TEG-90 de SITEUR, Guadalajara: vino con franjas blancas, dos cuerpos articulados sobre un bogie compartido | Catenaria |
| `metro-orange` | NC-82 del Metro de la Ciudad de México: frente facetado y rodadura neumática | Barra guía |
| `metro-gray` | Flota L del Metro de São Paulo (como el L43): acero inoxidable acanalado y máscara negra | Tercer riel |
| `metro-yellow` | A650 renovado de Los Ángeles: frente amarillo con puerta de emergencia al centro | Tercer riel |
| `metro-white` | Alstom Metropolis de la Línea 3 de Guadalajara: banda oscura en las ventanas y cara negra | Catenaria |
| `bullet` | Tren de alta velocidad | Catenaria |

Con `train: auto` el modelo sube conforme ganas vagones: tranvía → metro naranja → metro gris → metro amarillo → metro blanco → tren bala.

Cada tren tiene cabina en ambos extremos (faros blancos adelante, luces rojas atrás). La catenaria solo aparece sobre los trenes con pantógrafo; los demás van por tercer riel.

![Tres vías](docs/example-multi.svg)

## Haz tu propio tren (a mano o con IA)

Cualquier tren cabe en un JSON pequeño: colores, franjas, puertas y el frente dibujado fila por fila. No necesitas programar.

**A mano, en el [estudio](https://cracksmity.github.io/git-trains/studio/):** parte de cualquier modelo, cambia cada color y franja en un formulario, dibuja la trompa (o una locomotora de vapor completa) píxel por píxel, sobre una foto si quieres, y mira cómo se actualizan la escena y la miniatura del calendario. Descarga el JSON o copia un link que lleva el tren completo para compartirlo.

**Con IA:** una IA lo escribe a partir de una foto o una descripción:

1. Pega [docs/ai/train.md](docs/ai/train.md) en el chat de tu IA (Claude, ChatGPT, Gemini...) y, al final, describe tu tren o adjunta una foto. Las instrucciones están en inglés, pero puedes hablarle en español.
2. Guarda el JSON que te dé en tu repositorio de perfil, por ejemplo como `.github/train.json`.
3. En el workflow usa `train: .github/train.json`.

```yaml
      - uses: Cracksmity/git-trains@v1
        with:
          train: .github/train.json
          skyline: new-york
          language: es
```

¿Prefieres un solo comando? [Diseña desde la terminal](#diseña-desde-la-terminal) ejecuta tu CLI de IA y el validador por ti, con reintentos incluidos.

Si algo no cuadra (un color mal escrito, una fila de más), la Action se detiene y lista **todos** los problemas en el log; pégaselos a la IA para que los corrija. En el [playground](https://cracksmity.github.io/git-trains/preview/) (o localmente con `npm run preview`) puedes pegar el JSON y verlo al instante, con los mismos mensajes.

![Metro de Nueva York](docs/example-new-york.svg)

Ejemplos en [examples/trains](examples/trains): los R160 del metro de Nueva York, la serie 400 del Metro de Osaka, el tren CAF del Metro de Medellín (salió de una [comparativa de diez corridas de IA](https://cracksmity.github.io/git-trains/benchmarks/medellin/) con las mismas guías y fotos) y una locomotora tanque de vapor. El formato usa las mismas claves que [src/models.js](src/models.js), así que un tren que guste puede entrar al catálogo tal cual. El archivo solo se lee como datos: nada en él se ejecuta, y cada color y medida se revisa antes de dibujar.

**Trenes de vapor.** Con `loco` en vez de `nose`, el tren lleva una locomotora al frente: su propio dibujo de 30 filas, con la chimenea y el domo por encima de los vagones, ruedas motrices unidas por una biela que se mueve y humo que sale más seguido cuanto más rápido va. Los vagones van detrás y el último termina en una cola plana con farol rojo.

![Tren de vapor](docs/example-steam.svg)

## Skylines de ciudades

Detrás del tren hay una ciudad. Por defecto se genera a partir de tu usuario: es solo tuya y es la misma todos los días. Con `skyline: .github/skyline.json` es la ciudad que quieras. Vienen dos incluidas:

| `skyline` | Lo que se ve |
| --- | --- |
| `new-york` | One World Trade Center, Empire State, Chrysler, el puente de Brooklyn y la Estatua de la Libertad |
| `osaka` | La pagoda de Shitennō-ji, la rueda de la fortuna, Tsutenkaku, Abeno Harukas, el Umeda Sky Building, un puente atirantado y el castillo |

Un skyline es una lista de edificios en pixel art, **sin demasiado detalle**: cada uno es un bloque con un remate (escalonado, aguja, antena, cúpula, pirámide) o un dibujo fila por fila para los monumentos con forma propia. No tiene colores propios: usa los del tema, así que cambia solo entre claro y oscuro y de noche se encienden las ventanas. Para hacer el tuyo, pega [docs/ai/skyline.md](docs/ai/skyline.md) en tu IA con la ciudad que quieres o una foto. Ejemplos en [examples/skylines](examples/skylines) (Ciudad de México, Medellín).

![Osaka](docs/example-osaka.svg)

## Diseña desde la terminal

¿Ya usas Codex, Antigravity o Claude Code? Deja que haga todo el ciclo por ti: escribe el JSON, el validador lo revisa y los problemas vuelven a la IA hasta que pasa.

```bash
npx github:Cracksmity/git-trains design train "Osaka Metro 400 series" --photo tren.jpg
npx github:Cracksmity/git-trains design skyline "Lisboa"
```

Desde un clon, `node bin/git-trains.js design ...` hace lo mismo. Necesita Node 24 y una de estas CLI instalada y con sesión iniciada (usa tu propia suscripción, no hay que registrarse en nada más): `codex`, `agy` (Antigravity) o `claude`. Por defecto toma la primera que responda a `--version`, en ese orden.

Qué pasa:

1. Arma un prompt con la guía para IA ([tren](docs/ai/train.md) o [skyline](docs/ai/skyline.md)) más tu descripción y tus fotos.
2. Ejecuta la CLI sin interfaz, **solo lectura y en una carpeta temporal vacía**: Codex en su sandbox de solo lectura, Claude Code con la herramienta Read únicamente (para las fotos) y Antigravity con un hook que rechaza cualquier comando. Solo se lee la respuesta final, así que tus archivos nunca se tocan y nada corre con `--dangerously-skip-permissions`.
3. Saca el JSON de la respuesta y lo revisa con el mismo validador que la Action. Si hay problemas, la lista vuelve a la IA para otro intento, hasta `--tries`.
4. Cuando pasa, escribe `.github/train.json` (o `.github/skyline.json`), dibuja una imagen pequeña en la terminal (caracteres de medio bloque, en una terminal con color verdadero) e imprime un enlace al [estudio](https://cracksmity.github.io/git-trains/studio/) que lleva el archivo completo, para que lo retoques a mano.

| Opción | Qué hace |
| --- | --- |
| `--photo <archivo>` | Una foto de la que partir (png, jpg, webp, gif; hasta 20 MB). Repítela para varias. |
| `--ai codex\|gemini\|claude` | Qué CLI usar (`gemini` ejecuta `agy`). Por defecto, la primera instalada. |
| `--model <slug>` | El modelo de esa CLI, por ejemplo `gpt-6.1-terra`. Por defecto, el de la propia CLI. |
| `--out <archivo>` | Dónde escribirlo. Por defecto `.github/train.json` o `.github/skyline.json`. |
| `--tries <n>` | Intentos, cada uno con los problemas del validador. Por defecto 3. |
| `--force` | Reemplaza `--out` si existe. Sin esto, un archivo existente nunca se sobrescribe. |
| `--no-preview` | Omite la imagen en la terminal. |

Si ningún intento pasa, no se escribe nada en `--out`: la última respuesta queda al lado como `<out>.draft` y se imprimen los problemas que faltan, listos para pegarlos a una IA, abrirlos en el estudio o reintentar con más `--tries`. Cada intento es una ejecución completa de la IA y los modelos fuertes pueden pensar varios minutos, así que una corrida puede tardar.

## Comparte tu ciudad

El [depósito comunitario](community/README.md) reúne trenes y skylines que la gente dibuja de sus propias ciudades: tu metro, el tranvía en el que vas al trabajo, el skyline que ves desde tu ventana. Míralos en la [galería](https://cracksmity.github.io/git-trains/gallery/), abre cualquiera en el estudio para hacerlo tuyo, o descarga su JSON y úsalo como `train: .github/train.json` o `skyline: .github/skyline.json`.

Para agregar el tuyo:

1. Dibújalo con IA como arriba y revísalo en el [playground](https://cracksmity.github.io/git-trains/preview/#yours).
2. Agrega `"author"` (tu usuario de GitHub) y una `"description"` del tren o la ciudad real (en inglés, como el resto del depósito), y guárdalo como `community/trains/<id>.json` (el nombre del archivo es su `id`) o `community/skylines/<ciudad>.json`.
3. Abre un pull request, uno por tren o skyline. Una revisión automática lo valida igual que la Action, dibuja una vista previa en claro y oscuro (más el mini tren del modo calendario) y la deja en un comentario. Cuando se fusiona, aparece en la galería.

Las reglas son pocas: nada de logos ni letreros, una descripción del tren o la ciudad real, uno por pull request. Están en [community/README.md](community/README.md). ¿No tienes tiempo de dibujarlo? [Pide una ciudad o un tren](https://github.com/Cracksmity/git-trains/issues/new?template=city-request.yml) y alguien más puede tomarlo.

## Tarjetas de perfil

Con `cards: both` la Action también escribe `card-stats.svg` y `card-languages.svg`: una tarjeta de estadísticas (estrellas, commits del último año, PRs, issues y repos en los que contribuiste, con un anillo de rango) y otra con tus lenguajes más usados. Siguen el diseño de las tarjetas de [github-readme-stats](https://github.com/anuraghazra/github-readme-stats), pero **se generan dentro de tu workflow** con el código de este proyecto: sin un servicio externo que se pueda caer y sin actions de terceros. Con `language: es` salen en español.

![Estadísticas](docs/card-stats.svg) ![Lenguajes](docs/card-languages.svg)

Si la consulta de estadísticas falla (por ejemplo, por un límite de la API), la Action deja un `::warning::` y sigue: el tren se genera igual. El rango es una aproximación (una mezcla ponderada de commits, PRs, issues, reseñas, estrellas y seguidores).

## Cómo funciona

- Sin dependencias ni paso de build: JavaScript que corre directo en el runner (Node 24).
- Cada tren se dibuja **en código sobre una rejilla común** (coches de 64 px con 2 o 3 puertas por lado, bogies con dos ruedas de disco de 7 px, bastidor y cajas de grasa, pintados con la paleta de cada modelo), no a partir de imágenes. Las capas (caja, puertas, ruedas, letrero, chispas, humo) se animan por separado.
- El resultado es un SVG de ~40 KB (~75 KB en modo `multi`) con CSS: el tren avanza **de 1 px en 1 px** (`steps()`), las marcas de las ruedas alternan entre dos fotogramas, las nubes se desplazan y las estrellas titilan en el tema oscuro. Respeta `prefers-reduced-motion`.
- El letrero LED usa su propia fuente de 3×5 píxeles; el tren no usa texto SVG, así que no depende de fuentes.
- Si la API de GitHub falla un momento, se reintenta con espera creciente (los 502 son comunes en consultas GraphQL pesadas).

## Hecho con un director de IAs

Este proyecto lo construye una IA que dirige a otras. [tools/conductor](tools/conductor) le pasa cada tarea a Codex o a Antigravity (Gemini) según su tipo, la corre en un worktree de git aislado, revisa el resultado con filtros (tests, el validador, enlaces, traducción), le devuelve los fallos y sube a un modelo más fuerte cuando uno sigue fallando. El reparto sale de la [comparativa de Medellín](https://cracksmity.github.io/git-trains/benchmarks/medellin/), donde diez corridas de IA diseñaron el mismo tren y skyline.

## Desarrollo

```bash
npm run preview    # playground en http://localhost:4173 (controles en vivo)
npm run sample     # escribe SVG con datos de muestra en ./sample
npm test           # tests
npm run docs       # regenera los SVG de docs/
npm run community  # revisa community/ y regenera community/index.json para la galería
node scripts/sheet.js sheet.png 5 3 0                                # hoja PNG ampliada de todos los modelos
node scripts/sheet.js mine.png 5 2 0 examples/trains/new-york.json   # ...o de un tren en JSON
```

Lee [CONTRIBUTING.md](CONTRIBUTING.md) para agregar un modelo, un skyline o lo que sea.

## Créditos

La idea de convertir la actividad en una imagen viva viene de [git-koi](https://github.com/yalongwastaken/git-koi). Los trenes toman de las fotos de los reales solo el color y la forma; no se reproducen logotipos ni rótulos.

## Licencia

[MIT](LICENSE).
