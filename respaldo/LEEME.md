# Respaldo completo — Sistema Kiosco Caballeriza

Este carpeta guarda todo lo necesario para no perder nada al formatear el PC.

## Contenido

- **`memoria-claude/`** — La memoria de Claude Code para este proyecto (MEMORY.md y las
  notas: arranque del servidor, decisión del dinero como Float).
- **`chat/conversacion-completa.jsonl`** — El historial completo de la conversación con
  Claude (todo el desarrollo). **Las contraseñas fueron redactadas** (aparecen como
  `REDACTED_DB_PASSWORD` / `REDACTED_SECRET`) por seguridad.
- **`env-backup.txt`** — Plantilla del archivo `.env` (sin secretos reales).
- El **código completo** del proyecto está en la raíz de este mismo repositorio.

## Cómo restaurar en el PC nuevo

1. Instala Node.js (v18+), PostgreSQL y Git.
2. Clona el repo:  `git clone https://github.com/mantilla16/kiosko.git`
3. Entra a la carpeta y `npm install`.
4. Crea el archivo `.env` en la raíz usando `env-backup.txt` (o `.env.example`) como guía.
   - Los valores reales de producción están en **Vercel → Settings → Environment Variables**.
5. `npx prisma generate`
6. Para desarrollo local: crea la BD y corre `npx prisma migrate deploy` y `npm run db:seed`.
7. `npm start`  → http://localhost:3000

## Restaurar la memoria de Claude

Copia el contenido de `memoria-claude/` de vuelta a:
`C:\Users\<TU_USUARIO>\.claude\projects\C--Users-...-sistemaCaballeriza\memory\`

## IMPORTANTE — seguridad (hazlo en el PC nuevo)

Como este respaldo se subió a un repositorio **público**:

1. **Haz el repo privado**: GitHub → repo `kiosko` → Settings → Danger Zone → Change visibility → Private.
2. **Rota los secretos** (aunque se redactaron del chat, por precaución):
   - En **Neon**: resetea la contraseña de la base de datos.
   - Genera un **JWT_SECRET** nuevo.
   - Actualiza ambos en **Vercel → Environment Variables** y vuelve a desplegar.
