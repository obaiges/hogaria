# Hogaria

App web instalable (PWA) para gestionar un hogar compartido en tiempo real: compra, comidas, recetas, tareas, horarios, calendario, gastos y facturas, con IA.

- **URL de producción:** https://hogaria.obaiges.com
- **API:** https://api.hogaria.obaiges.com
- **Estado:** fase de documentación. Todavía no hay código.

## Empezar

1. Lee [AGENTS.md](AGENTS.md): flujo de trabajo, reglas y mapa de la documentación.
2. Consulta [BOARD.md](BOARD.md) para ver qué toca hacer.
3. Lee la visión en [docs/00-vision-alcance.md](docs/00-vision-alcance.md).

## Stack

React + Vite + TypeScript (PWA) · NestJS + Prisma · PostgreSQL (Neon) · Socket.IO · Better Auth (email/usuario + Google) · Gemini · Web Push. Los detalles están en [docs/01-arquitectura.md](docs/01-arquitectura.md).

## Instalar la app en el móvil

- **Android (Chrome):** abre la URL y elige menú ⋮ → "Instalar aplicación".
- **iPhone (Safari):** abre la URL y elige Compartir → "Añadir a pantalla de inicio". Las notificaciones solo funcionan con la app instalada (iOS 16.4 o superior).
