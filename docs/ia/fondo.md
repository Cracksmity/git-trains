# Diseña el fondo (skyline) para git-trenes

> **Si eres una persona:** copia todo este archivo en el chat de tu IA (Claude, ChatGPT, Gemini...) y, al final, di qué ciudad quieres o adjunta una foto del skyline. La IA te devuelve un JSON: pégalo en el playground para verlo (ver el README) y guárdalo en tu repositorio de perfil como `.github/fondo.json`.

## Tu tarea

Eres un diseñador de pixel art. Vas a describir el **skyline de una ciudad** como JSON para git-trenes, una GitHub Action que dibuja un tren en pixel art (SVG) pasando delante de una ciudad.

El fondo es **pixel art de siluetas, con poco detalle**: bloques de un solo color por plano, que se reconozcan por su forma (una aguja, una cúpula, un escalonado), no por sus ventanas. Los colores no los eliges tú: el programa pinta los edificios con el color del tema (claro de día, oscuro con ventanas encendidas de noche).

Responde con **un solo bloque `json`** con el fondo completo y, como mucho, dos líneas de explicación. Si la persona te pega errores del validador, corrígelos todos y devuelve otra vez el JSON completo.

## Reglas

1. **Pocos edificios y reconocibles.** Elige de 4 a 8 edificios o monumentos emblemáticos y exagera un poco su forma. Con `"fill": true` el programa rellena los huecos con edificios bajos genéricos.
2. **Sin logotipos ni letreros.** Solo siluetas.
3. Si te dan una foto, respeta el orden de izquierda a derecha y las proporciones relativas (cuál es el más alto, cuál es ancho), no las medidas reales.

## La escena

```
x = 0 ............................................. x = 447
y = 0   cielo
        [rótulo de la estación: x 10-90, y 10-24]      [sol o luna: x 382-402, y 10-30]
        ...
y = 63  aquí empieza el tren: casi siempre tapa el ancho completo de y = 63 a 88
y = 88  suelo (la base de todos los edificios)
```

- Cada edificio se apoya en el suelo (y = 88). Su altura máxima es 84.
- **El tren tapa la parte baja** (unos 25 píxeles) en casi todo el ancho: lo que quieras que se vea debe medir **más de 30 de alto**. Lo bajo (puentes, monumentos pequeños) solo se ve cuando el tren es corto.
- Evita torres muy altas en `x < 90`, donde va el rótulo con el nombre de la persona.
- Todo es en píxeles: un rascacielos típico mide de 8 a 20 de ancho.

## Formato

```
{
  "name": "Nombre de la ciudad",
  "fill": true,
  "buildings": [ ...edificios... ]
}
```

| campo | qué es |
| --- | --- |
| `name` | nombre para mostrar |
| `fill` | `true` (por defecto): rellena los huecos con edificios bajos genéricos. `false`: solo se dibuja lo que pongas |
| `buildings` | lista de 1 a 120 edificios |

### Un edificio con forma (`w`, `h`, `top`)

```json
{ "name": "Empire State", "x": 164, "w": 20, "h": 34, "top": [{ "type": "stepped", "steps": 3, "h": 4 }, { "type": "spire", "h": 5 }, { "type": "antenna", "h": 8 }] }
```

| campo | qué es |
| --- | --- |
| `x` | columna izquierda (-40 a 447) |
| `w` | ancho (2 a 200; las montañas pueden ser anchas) |
| `h` | alto del cuerpo, **sin** el remate (2 a 84) |
| `layer` | `"near"` (por defecto): delante, más oscuro y con ventanas. `"far"`: atrás, más claro, sin ventanas (montañas, edificios lejanos) |
| `windows` | `true`/`false` para forzar ventanas (por defecto, solo en `near`) |
| `top` | remate: un tipo o una lista de hasta 4 que se encima uno sobre otro |
| `name` | nota para ti; no se dibuja |

Tipos de remate (`top`), cada uno como texto (`"spire"`) u objeto (`{ "type": "spire", "h": 10 }`):

| tipo | forma | opciones |
| --- | --- | --- |
| `flat` | azotea plana | |
| `stepped` | escalonado (cada piso más angosto) | `steps` 1-4, `h` alto de cada piso |
| `pyramid` | se adelgaza hasta una punta | `h` alto, `tip` ancho de la punta (con `tip` grande queda un tronco de pirámide, como un volcán) |
| `dome` | cúpula | `h` alto |
| `spire` | aguja | `h` alto |
| `antenna` | antena de 1 píxel | `h` alto |

Encimar remates sirve para casi todo: `["stepped", "antenna"]`, `[{ "type": "pyramid", "tip": 4 }, "spire"]`...

### Un edificio dibujado (`rows`)

Para monumentos con forma propia (un puente, una estatua, una catedral) dibújalos fila por fila, de arriba abajo. La última fila toca el suelo.

| símbolo | qué es |
| --- | --- |
| `#` | edificio |
| `w` | ventana (se enciende de noche) |
| `.` | vacío |

```json
{ "name": "Ángel de la Independencia", "x": 130, "rows": [
  "#.#.#",
  ".###.",
  "..#..",
  ".###.",
  "..#..",
  "..#..",
  "..#..",
  ".###.",
  "#####"
] }
```

Con `rows` no se usan `w`, `h` ni `top`. Máximo 84 filas y 200 columnas.

## Ejemplo completo

Ciudad de México: el Popocatépetl al fondo, Bellas Artes, el Ángel, la Torre Latinoamericana y las torres de Reforma, con relleno.

```json
{
  "name": "Ciudad de México",
  "fill": true,
  "buildings": [
    { "name": "Popocatépetl", "x": 300, "w": 120, "h": 2, "layer": "far", "windows": false, "top": [{ "type": "pyramid", "h": 30, "tip": 16 }] },
    {
      "name": "Palacio de Bellas Artes",
      "x": 96,
      "rows": [
        "............#............",
        "..........#####..........",
        ".........#######.........",
        "........#########........",
        "........#########........",
        ".......###########.......",
        "....#################....",
        "...###################...",
        "..#####################..",
        "..#w#w#w#w#w#w#w#w#w#w#..",
        "..#####################..",
        "..#w#w#w#w#w#w#w#w#w#w#..",
        "#########################",
        "#########################"
      ]
    },
    { "name": "Torre Latinoamericana", "x": 150, "w": 12, "h": 40, "top": [{ "type": "stepped", "steps": 2, "h": 3 }, { "type": "antenna", "h": 10 }] },
    { "name": "Torre Reforma", "x": 228, "w": 12, "h": 60 },
    { "name": "Torre BBVA", "x": 244, "w": 14, "h": 52 },
    { "name": "Torre Mayor", "x": 262, "w": 14, "h": 50, "top": [{ "type": "pyramid", "h": 3, "tip": 8 }] }
  ]
}
```

---

Ahora, la ciudad que quiero:
