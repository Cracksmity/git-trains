# Diseña un tren para git-trenes

> **Si eres una persona:** copia todo este archivo en el chat de tu IA (Claude, ChatGPT, Gemini...) y, al final, describe tu tren o adjunta una foto. La IA te devuelve un JSON: pégalo en el playground para verlo (ver el README) y guárdalo en tu repositorio de perfil como `.github/tren.json`.

## Tu tarea

Eres un diseñador de pixel art. Vas a describir un tren como **JSON** para git-trenes, una GitHub Action que dibuja un tren en pixel art (SVG) para el perfil de GitHub de una persona.

No dibujas el tren completo: el programa ya sabe dibujar el chasis (coches de 64 px de largo, ventanas, puertas, bogies, letrero LED, contorno, luces de cola). Tú decides:

- los **colores** (paleta),
- las **franjas** del costado,
- detalles como puertas, ventanas, pantógrafo o llantas,
- y la **trompa**: el frente del coche cabeza visto de lado, dibujado píxel por píxel.

Responde con **un solo bloque `json`** con el tren completo y, como mucho, dos líneas de explicación. Si la persona te pega errores del validador, corrígelos todos y devuelve otra vez el JSON completo.

## Reglas

1. **Sin logotipos, letras ni marcas.** De una foto toma colores y formas, nunca el logo del operador ni textos.
2. **Pixel art de verdad:** pocos colores y contrastes claros. Toda la caja mide solo 20 píxeles de alto, así que piensa en manchas de color, no en detalles finos.
3. Si te dan una foto, fíjate en: color de la caja, del techo y de las puertas; franjas; si las ventanas van sobre una banda oscura; y la forma del frente (plano, inclinado, aerodinámico, con máscara negra...).
4. El símbolo `a` se pinta con el **color del lenguaje de programación principal** de la persona (cambia solo). Úsalo al menos en una fila de `bands` para que se note.
5. Colores siempre en hexadecimal `#rrggbb`.

## Cómo está hecha la caja (20 filas, de arriba abajo)

```
fila 0-1    techo claro            pal.roofHi
fila 2      techo                  pal.roof
fila 3      borde del techo        símbolo de "row3"
filas 4-10  parte alta             pal.upper; ventanas entre win.y0 y win.y1
filas 11-17 franjas del costado    "bands": 7 símbolos, uno por fila
filas 18-19 faldón                 pal.skirt
```

Símbolos de `bands` y `row3`:

| símbolo | color |
| --- | --- |
| `b` | `pal.body` (cuerpo) |
| `h` | `pal.bodyHi` (cuerpo claro) |
| `l` | `pal.bodyLo` (cuerpo oscuro) |
| `t` | `pal.trim` (franja fija, por ejemplo blanca) |
| `d` | `pal.dark` (muy oscuro) |
| `u` | `pal.upper` (parte alta) |
| `a` | color del lenguaje de la persona |

## Campos del JSON

| campo | obligatorio | qué es |
| --- | --- | --- |
| `id` | no | minúsculas, números y guiones, por ejemplo `"metro-nueva-york"` |
| `name` | no | nombre para mostrar (máximo 40 letras) |
| `description` | no | de qué tren real se inspira; no se dibuja |
| `pal` | **sí** | paleta; solo `body` es obligatorio, el resto se calcula si falta (ver abajo) |
| `bands` | no | 7 símbolos para las filas 11-17, por ejemplo `"bbaabll"` (por defecto) |
| `row3` | no | símbolo del borde del techo (por defecto `"u"`) |
| `win` | no | `{ "y0": 3..6, "y1": 8..12 }`, filas del marco de las ventanas (por defecto `{ "y0": 4, "y1": 10 }`) |
| `winBand` | no | color de una banda continua detrás de las ventanas (como muchos metros modernos) |
| `doors` | no | puertas por lado en cada coche: `2` (por defecto) o `3` |
| `nose` | **sí** | la trompa (ver abajo) |
| `pant` | no | `"lead"` pantógrafo en la cabina, `"alt"` uno cada dos coches, `null` tercer riel (por defecto) |
| `pantX` | no | con `"lead"`: columna del pantógrafo en el techo de la cabina (por defecto 24) |
| `roofBoxes` | no | equipos hundidos en el techo (`true` por defecto) |
| `articulated` | no | coches en pares que comparten un bogie, como un tranvía (`false`) |
| `tyres` | no | llantas de goma, como el metro de la CDMX o de París (`false`) |
| `cabWindows` | no | ventanas extra en la cabina detrás de la puerta: número par de 4 a 30 (el tren bala usa 14) |
| `cabBogieOff` | no | distancia de la punta al bogie de la cabina, 14 a 30 (18 por defecto; una trompa larga necesita más) |

### Paleta (`pal`)

| clave | qué pinta | si falta |
| --- | --- | --- |
| `body` | **el color principal de la caja** | obligatorio |
| `bodyHi`, `bodyLo` | versión clara y oscura del cuerpo | se calculan de `body` |
| `upper` | parte alta (filas 4-10) | igual que `body` |
| `roof`, `roofHi`, `roofVent` | techo, su brillo y los equipos hundidos | gris |
| `trim` | franja fija (`t`) | casi blanco |
| `dark` | partes muy oscuras (`d`) | gris muy oscuro |
| `glass`, `glassHi` | cristal y su reflejo | azul muy oscuro |
| `door`, `doorHi` | puertas y su brillo | igual que `body` |
| `skirt`, `outline`, `gangway`, `wheel` | faldón, contorno, fuelle, ruedas | grises de siempre |

## La trompa (`nose`)

Es el frente del coche cabeza **visto de lado**, mirando a la derecha: 20 filas (las mismas de la caja) y de 4 a 30 columnas. La columna 0 se pega al coche y la última es la punta. La cola del tren usa la misma trompa espejada y ahí los faros se vuelven luces rojas.

Hay tres formas de darla:

**1. Reutilizar una del catálogo** (lo más fácil), con tus colores:

```
"nose": "metro-gris"
"nose": { "base": "metro-amarillo", "color": "#d0d4da", "face": "#15171c" }
```

| base | forma |
| --- | --- |
| `tranvia` | frente redondeado de tranvía con parabrisas grande |
| `metro-naranja` | frente facetado: el parabrisas se inclina hacia los faros |
| `metro-gris` | frente casi vertical con máscara negra |
| `metro-amarillo` | frente plano pintado (`color`) con máscara negra y puerta al centro |
| `metro-blanco` | cara negra (`face`) enmarcada en el color de la caja |
| `bala` | nariz larga aerodinámica de tren de alta velocidad (24 columnas) |

**2. Dibujarla fila por fila con `rows`** (la más flexible): 20 textos del mismo largo, uno por fila, de arriba abajo.

| símbolo | color |
| --- | --- |
| `s` | sigue el costado: el color que la caja tiene en esa fila (techo, parte alta, franja...) |
| `n` | pintura del frente: `nose.color` (si falta, igual que `s`) |
| `f` | panel o máscara frontal: `nose.face` (si falta, `pal.dark`) |
| `g` / `G` | cristal / reflejo del cristal |
| `l` | **faro** (blanco; en la cola, rojo). **Pon al menos uno.** |
| `y` | luz ámbar (en la cola, roja) |
| `q` | piloto rojo apagado (en la cola, encendido) |
| `r` | luz roja |
| `i` | letrero de destino (LED ámbar) |
| `k` | defensa oscura |
| `o` | contorno |
| `m` / `h` | cuerpo oscuro / claro |
| `a` | color del lenguaje |
| `t` / `d` | franja fija / muy oscuro |
| `.` | vacío (fuera del tren) |

Reglas de `rows`:

- Exactamente **20 filas**; la primera columna de cada fila nunca es `.`.
- Las filas cortas se rellenan con `.` a la derecha: la silueta se lee por dónde termina cada fila.
- El **contorno se dibuja solo**: el último píxel ocupado de cada fila y los bordes de arriba y abajo se vuelven contorno. Deja los detalles al menos a un píxel del borde.
- Las filas 18-19 suelen llevar la defensa (`k`), un poco más corta que el frente.

**3. `edge` + `ops`** (avanzado, así están escritos los modelos del catálogo): `w` columnas, `edge` = 20 números con la última columna ocupada de cada fila, y `ops` = pinturas encima: `["r", x0, y0, x1, y1, símbolo]` rectángulo, `["p", x, y, símbolo]` píxel, `["f", x0, y0, x1, y1, símbolo]` marco, `["e", y0, y1, a, b, símbolo]` por fila de `edge-a` a `edge-b` (sigue la inclinación), `["ep", y, dx, símbolo]` píxel en `edge[y] + dx`.

## Límites

- Con 6 vagones el tren entero debe caber en 448 px: una trompa de hasta ~30 columnas cabe; con `cabWindows`, menos.
- Claves desconocidas son error (para atrapar errores de dedo); las que empiezan con `_` se ignoran.

## Ejemplo completo

Metro de Nueva York inspirado en los R160: acero inoxidable, frente gris con máscara negra, parabrisas, letrero de ruta, faros abajo y la franja del lenguaje.

```json
{
  "id": "metro-nueva-york",
  "name": "Metro de Nueva York",
  "description": "Inspirado en los R160: acero inoxidable acanalado, frente gris con máscara negra, letrero de ruta y faros abajo.",
  "pal": {
    "body": "#b4b9c1",
    "bodyHi": "#d0d4da",
    "bodyLo": "#8e939b",
    "roof": "#8a8f98",
    "trim": "#2a2d35",
    "glass": "#1f232c",
    "door": "#c0c4cb"
  },
  "bands": "hbaalbl",
  "row3": "h",
  "win": { "y0": 4, "y1": 9 },
  "doors": 3,
  "nose": {
    "color": "#9fa4ac",
    "face": "#15171c",
    "rows": [
      "sssssssss...",
      "ssnnnnnnnnn.",
      "sssnnnnnnnnn",
      "sssnfffffffn",
      "sssnfGggfifn",
      "sssnfgggfifn",
      "sssnfgggfffn",
      "sssnfgggfgfn",
      "sssnfgggfgfn",
      "sssnfgggfgfn",
      "sssnfffffffn",
      "sssnnnnnnnnn",
      "sssnnaaaaaan",
      "sssnnnnnnnnn",
      "sssnnqnnnlln",
      "sssnnqnnnlln",
      "sssnnnnnnnnn",
      "sssnnnnnnnnn",
      "sssssskkkkkk",
      "ssssskkkkkk."
    ]
  },
  "pant": null,
  "roofBoxes": true
}
```

Un tren mínimo también vale:

```json
{ "name": "Mi tren verde", "pal": { "body": "#1a7f37" }, "nose": "metro-blanco" }
```

---

Ahora, el tren que quiero:
