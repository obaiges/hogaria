# Despliegue de Hogaria

> El aprovisionamiento completo de la VM (VCN, `iptables`, Docker, usuario `deploy`, `.env`, Caddy…) llega con **HOG-021**. Ver el resumen en [`docs/06-despliegue.md`](../docs/06-despliegue.md).

## CLI de administración

La imagen de la API incluye la CLI compilada en `dist/cli/main.js`. Usa las mismas variables de entorno que la API (`DATABASE_URL`).

### Crear el administrador de la plataforma (`create-owner`)

Crea el primer usuario (el dueño de la instancia) **sin invitación**, con el email ya verificado y `isPlatformAdmin = true` (spec 01, RN-01-30). Solo puede haber uno. No crea ningún hogar: el administrador lo crea al entrar, desde `/grupos`.

```bash
# En la VM, desde el directorio del compose de producción.
# Pide la contraseña dos veces sin mostrarla (-it para tener terminal):
docker compose exec -it api node dist/cli/main.js create-owner \
  --email tu@email.com --username tu_usuario --name "Tu nombre"

# Sin terminal (p. ej. desde un script), la contraseña se lee de OWNER_PASSWORD:
docker compose exec -e OWNER_PASSWORD api node dist/cli/main.js create-owner \
  --email tu@email.com --username tu_usuario
```

`--name` es opcional: si falta, se usa el username. La contraseña cumple la misma política que el registro (10–128 caracteres, no puede ser una contraseña común ni contener el email o el username).

Termina con código ≠ 0 y un mensaje claro si:

- ya existe un administrador de la plataforma,
- el email o el nombre de usuario ya están en uso,
- algún dato no es válido o las dos contraseñas no coinciden.

En local: `pnpm --filter api cli create-owner --email … --username …` (compila y usa `apps/api/.env`).
