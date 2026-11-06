<p align="center"><img src="docs/logo.svg" alt="git-trains logo" width="128" height="128"></p>

<h1 align="center">git-trains</h1>

<p align="center"><a href="README.md">English</a> · <b>Español</b></p>

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

<sub>Ese es el tren del autor hoy, con su [calendario](#modo-calendario); [el workflow de este repo](.github/workflows/train.yml) lo vuelve a dibujar cada mañana. Prueba todas las opciones en el **[playground](https://cracksmity.github.io/git-trains/preview/)**. ¿Lo quieres para un proyecto en vez de un perfil? Mira [En el README de un repositorio](#en-el-readme-de-un-repositorio).</sub>

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
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
      - uses: Cracksmity/git-trains@5171f5f238c4609b276c8718b4764f59ba49b398 # security fixes after v1.1.1
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

## Documentación

- [Escenas, calendarios, tarjetas y modo repositorio](docs/es/usage.md)
- [Todas las opciones y los modelos incluidos](docs/es/reference.md)
- [Diseños, CLI y comunidad](docs/es/customization.md)
- [Desarrollo y créditos](docs/es/development.md)

## Preparar el desarrollo

Requisito: Node.js 24 o posterior con npm. El Action y el CLI no tienen dependencias de ejecución; lint y tipos usan dependencias de desarrollo fijadas.

```sh
git clone https://github.com/Cracksmity/git-trains.git
cd git-trains
npm ci
```

Ejecuta `npm run preview` para abrir el playground, `npm run sample` para generar SVG de muestra y `npm run check` para verificar el proyecto. No hay compilación.

La arquitectura separa las reglas de actividad, gráficos, trenes y paisajes, acceso a GitHub e interfaces. Consulta [arquitectura](docs/architecture.md), [comandos](scripts/README.md), [contribuciones](CONTRIBUTING.md) e [instrucciones para agentes](AGENTS.md).

<a id="qué-significa-cada-parte"></a>[Qué significa cada parte](docs/es/usage.md#qué-significa-cada-parte)
<a id="vagones-desbloqueables"></a>[Vagones desbloqueables](docs/es/usage.md#vagones-desbloqueables)
<a id="modo-calendario"></a>[Modo calendario](docs/es/usage.md#modo-calendario)
<a id="resumen-del-año"></a>[Resumen del año](docs/es/usage.md#resumen-del-año)
<a id="estaciones-y-fiestas"></a>[Estaciones y fiestas](docs/es/usage.md#estaciones-y-fiestas)
<a id="tarjetas-de-perfil"></a>[Tarjetas de perfil](docs/es/usage.md#tarjetas-de-perfil)
<a id="en-el-readme-de-un-repositorio"></a>[En el README de un repositorio](docs/es/usage.md#en-el-readme-de-un-repositorio)
<a id="cómo-funciona"></a>[Cómo funciona](docs/es/usage.md#cómo-funciona)
<a id="opciones"></a>[Opciones](docs/es/reference.md#opciones)
<a id="modelos"></a>[Modelos](docs/es/reference.md#modelos)
<a id="haz-tu-propio-tren-a-mano-o-con-ia"></a>[Haz tu propio tren (a mano o con IA)](docs/es/customization.md#haz-tu-propio-tren-a-mano-o-con-ia)
<a id="skylines-de-ciudades"></a>[Skylines de ciudades](docs/es/customization.md#skylines-de-ciudades)
<a id="diseña-desde-la-terminal"></a>[Diseña desde la terminal](docs/es/customization.md#diseña-desde-la-terminal)
<a id="comparte-tu-ciudad"></a>[Comparte tu ciudad](docs/es/customization.md#comparte-tu-ciudad)
<a id="hecho-con-un-director-de-ias"></a>[Hecho con un director de IAs](docs/es/development.md#hecho-con-un-director-de-ias)
<a id="desarrollo"></a>[Desarrollo](docs/es/development.md#desarrollo)
<a id="créditos"></a>[Créditos](docs/es/development.md#créditos)
<a id="licencia"></a>[Licencia](docs/es/development.md#licencia)
<a id="el-campo-de-una-región"></a>[El campo de una región](docs/es/customization.md#el-campo-de-una-región)
<a id="panel-de-salidas"></a>[Panel de salidas](docs/es/usage.md#panel-de-salidas)
