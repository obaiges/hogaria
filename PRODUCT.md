# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA instalable (Android e iOS mediante "Añadir a pantalla de inicio"), mobile-first. No se publica en tiendas.

## Stack

Delegado y confirmado: React + Vite + TypeScript + vite-plugin-pwa (frontend), NestJS + Prisma + PostgreSQL en Neon (backend), Socket.IO (tiempo real), Better Auth (login), Gemini (IA). Detalle en `docs/01-arquitectura.md`.

## Users

Familias y personas que comparten un hogar (pareja, familia con hijos, compañeros de piso). Acceso solo por invitación del propietario de la instancia. Usan la app desde el móvil, a ratos cortos durante el día: en el supermercado, en la cocina, al organizar la semana, al pagar algo.

## Product Purpose

Tener un control absoluto y compartido del hogar en un solo sitio: listas de la compra, planificación de comidas, recetas, tareas con rotación, horarios de trabajo, calendario, gastos de ocio, gastos fijos y facturas. Lo que hace un miembro del grupo lo ven los demás al instante. Éxito: la familia deja de usar WhatsApp, notas sueltas y hojas de cálculo para coordinar la casa.

## Positioning

Una única app privada (solo por invitación) que une la logística del hogar con IA práctica: una foto del frigorífico propone recetas reales con lo que hay, y un asistente por chat responde sobre los datos del propio grupo.

## Operating Context

- Uso con una mano, de pie, a menudo con prisa (pasillo del súper, cocina).
- Grupos pequeños (2–8 personas); un usuario puede pertenecer a varios grupos.
- Sin roles: todo miembro de un grupo puede hacer todo. Excepciones de propiedad: el calendario, los horarios y los gastos de ocio solo los edita su dueño, aunque todos los ven.
- Requiere conexión a internet (sin modo offline).

## Capabilities and Constraints

- Idioma único: español. Moneda única: EUR.
- Coste de infraestructura: 0 €.
- Login: email/username + contraseña, o Google. Sesión indefinida. Sin 2FA ni biometría por ahora.
- Notificaciones push solo para recordatorios y alertas en su fecha y hora.
- IA con límite diario de usos por grupo; las fotos se descartan tras analizarse.

## Brand Commitments

- Nombre: **Hogaria**.
- Color base pedido por el usuario: **azul turquesa**.
- Modo claro y oscuro.
- Logo: aún no existe; se autoriza a inventarlo.

## Evidence on Hand

Ninguna todavía: no hay logo, capturas, usuarios reales ni textos legales. No hay que inventar testimonios ni métricas.

## Product Principles

1. **Lo compartido se ve al instante.** Ningún cambio de otro miembro debería requerir recargar la app.
2. **Dos toques para lo frecuente.** Añadir a la lista, marcar una tarea o apuntar un gasto debe ser inmediato.
3. **Privado por defecto.** Solo entra quien es invitado; los datos de un grupo no salen de él.
4. **La IA ayuda y no decide.** Cualquier resultado de la IA se puede revisar y editar antes de guardarlo.
5. **Gratis de mantener.** Ninguna decisión técnica puede obligar a pagar sin que sea indispensable.

## Accessibility & Inclusion

Objetivo WCAG 2.2 AA: contraste suficiente en ambos temas, objetivos táctiles de al menos 44 px y respeto a `prefers-reduced-motion`.
