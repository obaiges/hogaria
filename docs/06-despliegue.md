# 06 · Despliegue e infraestructura (0 €)

## Servicios y límites gratuitos

> Los límites cambian. **Compruébalos al implementar cada ticket** y actualiza esta tabla con la fecha.

| Servicio | Uso | Plan | Límites relevantes (comprobar) | ¿Tarjeta? |
|---|---|---|---|---|
| **Netlify DNS** | Dominio `obaiges.com` (ya pagado) | — | Se añaden registros DNS gratis | — |
| **Cloudflare Pages** | Frontend estático `hogaria.obaiges.com` | Free | Ancho de banda ilimitado, 500 builds/mes | No |
| **Oracle Cloud Always Free** | VM para la API (Docker) | Always Free | VM ARM Ampere (hasta 4 OCPU / 24 GB) o AMD micro; 200 GB de disco; 10 TB de tráfico/mes | **Sí, solo para verificar** (no cobra si no se pasa a pago) |
| **Neon** | PostgreSQL | Free | Almacenamiento limitado por proyecto (~0,5 GB; verificar) y horas de cómputo al mes; se suspende sin uso | No |
| **Google Gemini API** | IA | Free tier | RPM/RPD por modelo; **los datos pueden usarse para mejorar productos de Google** | No |
| **Google Cloud (OAuth)** | Login con Google | Gratis | Pantalla de consentimiento en modo "Producción" sin verificar: hasta 100 usuarios | No |
| **Resend** | Emails (verificación, contraseña) | Free | ~3000 emails/mes, 100/día | No |
| **Oracle Object Storage** | Copias de seguridad | Always Free | 20 GB | (misma cuenta) |
| **GitHub** | Repo + Actions | Free | 2000 min/mes de CI en repos privados | No |
| **UptimeRobot** (opcional) | Monitor HTTP de `/health` y de la web | Free | Monitores cada 5 min, alerta por email | No |
| **Healthchecks.io** (opcional) | Latido de la copia semanal (`BACKUP_HEARTBEAT_URL`) | Free | 20 checks | No |

### Plan B si no quieres dar tarjeta a Oracle
Render (Free Web Service). La API se duerme tras 15 min sin tráfico: el primer acceso tarda unos 50 s y **los recordatorios programados en memoria se pierden mientras duerme**. Para compensarlo, un cron externo gratuito (cron-job.org) llama a `GET /health` cada 10 min. Sigue siendo peor opción. Está documentado como ADR-007 alternativo.

## Topología

```
hogaria.obaiges.com       CNAME → hogaria.pages.dev           (Cloudflare Pages)
api.hogaria.obaiges.com   A     → <IP pública de la VM Oracle> (Caddy → NestJS)
```

### Registros DNS en Netlify (Domains → obaiges.com → DNS settings)
| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `hogaria` | `<proyecto>.pages.dev` |
| A | `api.hogaria` | `<IP de la VM>` |
| TXT / CNAME | los que pida Resend para `hogaria.obaiges.com` (SPF/DKIM) | — |
| TXT | `_cf-custom-hostname…` si Cloudflare Pages pide verificación | — |

En Cloudflare Pages → Custom domains → añadir `hogaria.obaiges.com`. Como el DNS está fuera de Cloudflare, se hace con CNAME.

## Frontend (Cloudflare Pages)

- Repo de GitHub conectado. Build: `pnpm install --frozen-lockfile && pnpm --filter web build`. Salida: `apps/web/dist`.
- Variables de build: `VITE_API_URL=https://api.hogaria.obaiges.com`, `VITE_VAPID_PUBLIC_KEY=…`, `VITE_LEGAL_CONTROLLER_NAME=…` y `VITE_LEGAL_CONTACT_EMAIL=…` (las dos legales son **obligatorias**: el build de producción falla si faltan; spec 16, RN-16-28).
- `apps/web/public/_headers`: CSP y cabeceras de seguridad (ver `docs/03-seguridad.md`). `sw.js` con `Cache-Control: no-cache`.
- `apps/web/public/_redirects`: `/* /index.html 200` (SPA).

## API (VM Oracle)

```
deploy/
├─ Dockerfile.api          # multi-stage: build con pnpm → runtime node:lts-slim, usuario no root
├─ docker-compose.prod.yml # servicios: api, caddy
├─ Caddyfile               # api.hogaria.obaiges.com { reverse_proxy api:3000 { flush_interval -1 } }  (HTTPS automático; sin buffer para el SSE del asistente)
├─ backup.sh               # pg_dump → age → OCI Object Storage (rclone)
├─ verify-restore.sql      # recuentos para verificar una restauración
├─ systemd/                # hogaria-backup.service + hogaria-backup.timer (domingos 04:00 Europe/Madrid)
├─ journald/hogaria.conf   # MaxRetentionSec=14day, SystemMaxUse=500M → /etc/systemd/journald.conf.d/
└─ README.md               # aprovisionamiento, restauración y runbook de incidencias
```

### Aprovisionamiento (resumen; el detalle va en `deploy/README.md`, ticket HOG-022)
1. Crear la cuenta de Oracle Cloud y la VM Ubuntu LTS (ARM Ampere A1, 1 OCPU / 6 GB es más que suficiente). **La VM y el bucket de copias se crean en una región de la UE** (p. ej. `eu-frankfurt-1` o `eu-madrid-1`), como declara la política de privacidad.
2. Abrir los puertos 80 y 443 en la Security List de la VCN **y** en `iptables` de la VM.
3. Instalar Docker y el plugin compose. Crear un usuario `deploy` sin contraseña con clave SSH.
4. Copiar `deploy/` y el `.env` (permisos 600).
5. `docker compose -f docker-compose.prod.yml up -d`.
6. Actualizaciones de seguridad automáticas (`unattended-upgrades`) y `fail2ban` para SSH. SSH solo con clave.
7. **Logs:** los contenedores usan el driver `journald` (`logging: { driver: journald }` en el compose) y `/etc/systemd/journald.conf.d/hogaria.conf` fija `MaxRetentionSec=14day` y `SystemMaxUse=500M` (ADR-017). Consulta: `journalctl CONTAINER_NAME=hogaria-api`.
8. **Copias:** instalar `rclone` y `age`, crear `/opt/hogaria/backup.env` (permisos `600`) y activar `hogaria-backup.timer` (ver "Copias de seguridad").
9. **Healthcheck:** el `Dockerfile.api` declara `HEALTHCHECK` contra `GET /health` cada 30 s. Opcional: monitor de UptimeRobot.

### Despliegue continuo
GitHub Actions en `main`: lint, typecheck y tests → build de la imagen → push a GHCR (gratis) → SSH a la VM → `docker compose pull && docker compose up -d` → `prisma migrate deploy` (en el arranque del contenedor, con `DIRECT_URL`).

## Variables de entorno

### API (`apps/api/.env.example`)
```bash
NODE_ENV=production
PORT=3000
APP_URL=https://hogaria.obaiges.com
API_URL=https://api.hogaria.obaiges.com
COOKIE_DOMAIN=.hogaria.obaiges.com

DATABASE_URL=postgresql://...-pooler.../hogaria?sslmode=require
DIRECT_URL=postgresql://.../hogaria?sslmode=require

BETTER_AUTH_SECRET=            # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SIGNUP_REQUIRES_INVITE=true

RESEND_API_KEY=
EMAIL_FROM="Hogaria <no-reply@hogaria.obaiges.com>"

GEMINI_API_KEY=
GEMINI_MODEL=                  # p.ej. el Flash vigente del free tier
AI_LIMIT_FRIDGE_DETECT=10
AI_LIMIT_FRIDGE_RECIPES=15
AI_LIMIT_CHAT=60
AI_LIMIT_RECEIPT=20

VAPID_PUBLIC_KEY=              # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@obaiges.com

LOG_LEVEL=info
```

La API **no arranca** si falta una variable obligatoria; en particular, si `GEMINI_MODEL` está vacío (spec 13, RN-13-01).

### Web (`apps/web/.env.example`)
```bash
VITE_API_URL=http://localhost:3000
VITE_VAPID_PUBLIC_KEY=
VITE_LEGAL_CONTROLLER_NAME=     # responsable del tratamiento (obligatoria en producción)
VITE_LEGAL_CONTACT_EMAIL=       # email de contacto de privacidad (obligatoria en producción)
```

### Copias de seguridad (`/opt/hogaria/backup.env`, permisos 600, fuera del repo)
```bash
BACKUP_DATABASE_URL=           # conexión DIRECTA de Neon con el rol de solo lectura hogaria_backup
BACKUP_AGE_RECIPIENT=          # clave pública de age (la privada NUNCA está en la VM)
BACKUP_BUCKET=hogaria-backups
RCLONE_CONFIG_OCI_TYPE=s3
RCLONE_CONFIG_OCI_PROVIDER=Other
RCLONE_CONFIG_OCI_ENDPOINT=https://<namespace>.compat.objectstorage.<región-UE>.oraclecloud.com
RCLONE_CONFIG_OCI_ACCESS_KEY_ID=      # Customer Secret Key
RCLONE_CONFIG_OCI_SECRET_ACCESS_KEY=
BACKUP_HEARTBEAT_URL=          # opcional (Healthchecks.io)
```
Detalle de la copia, la retención (8 copias semanales) y la restauración en `docs/specs/17-calidad-produccion.md` (RN-17-21 a RN-17-26).

## Google OAuth (Google Cloud Console)

1. Proyecto "Hogaria" → APIs y servicios → Pantalla de consentimiento: tipo **Externo**, publicar en "Producción" (sin verificación hasta 100 usuarios; solo se usan los scopes `openid email profile`).
2. Credenciales → ID de cliente OAuth → Aplicación web.
   - Orígenes autorizados: `https://hogaria.obaiges.com`, `http://localhost:5173`.
   - URIs de redirección: `https://api.hogaria.obaiges.com/api/auth/callback/google`, `http://localhost:3000/api/auth/callback/google`.

## Neon

- Proyecto "hogaria", región UE (Frankfurt), base de datos `hogaria`.
- Rama `main` para producción. Opcional: rama `dev` para probar migraciones.
- Usar la cadena **pooled** en `DATABASE_URL` y la **direct** en `DIRECT_URL`.
- Crear un rol de **solo lectura** `hogaria_backup` para las copias (no forma parte del esquema Prisma; el procedimiento va en `deploy/README.md`).
