# LinkedIn Manager — Backend

Backend para la automatización real de LinkedIn usando **Node.js + Express + Playwright**.

## Tecnologías

| Tecnología | Rol |
|-----------|-----|
| **Express.js** | Servidor REST API |
| **Playwright (Chromium)** | Automatización de LinkedIn vía cookie de sesión |
| **SQLite (better-sqlite3)** | Base de datos local (sin servidor externo) |
| **node-cron** | Publicaciones programadas y automatizaciones |

---

## Instalación

### 1. Prerequisitos
- Node.js ≥ 18
- npm ≥ 9

### 2. Instalar dependencias

```bash
cd backend
npm install
```

### 3. Instalar navegador Chromium para Playwright

```bash
npx playwright install chromium
```

### 4. Crear el archivo de configuración

```bash
copy .env.example .env
```

Editá `.env` y ajustá los valores:

```env
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
HEADLESS=false          # false = ver el browser (útil para debug), true = invisible
ACTION_DELAY_MIN=2000   # delay mínimo entre acciones (ms)
ACTION_DELAY_MAX=8000   # delay máximo entre acciones (ms)
```

### 5. Arrancar el servidor

```bash
# Modo desarrollo (hot-reload con nodemon)
npm run dev

# Modo producción
npm start
```

El servidor arranca en **http://localhost:8000**

---

## Verificar que funciona

```bash
# Health check
curl http://localhost:8000/api/health

# Respuesta esperada:
# {"status":"ok","timestamp":"...","db":"sqlite","playwright":"ready"}
```

Cuando el backend está corriendo, el frontend lo detecta automáticamente (indicador verde "Backend ON" en la topbar).

---

## Endpoints disponibles

### Cuentas LinkedIn
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/api/accounts` | Listar cuentas conectadas |
| `POST` | `/api/accounts/connect` | Conectar cuenta con cookie `li_at` |
| `DELETE` | `/api/accounts/:id` | Desconectar cuenta |

### Publicaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/api/posts/queue` | Cola de publicaciones |
| `POST` | `/api/posts` | Crear / programar / publicar ahora |
| `DELETE` | `/api/posts/:id` | Eliminar post |
| `GET`  | `/api/posts/hashtags` | Hashtags sugeridos por tipo |

### Automatizaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/api/automations` | Listar automatizaciones |
| `POST` | `/api/automations` | Crear automatización |
| `POST` | `/api/automations/:id/toggle` | Activar/pausar |
| `GET`  | `/api/automations/stats` | Estadísticas globales |
| `GET`  | `/api/automations/log` | Log de acciones |

### Dashboard / Analíticas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET`  | `/api/metrics` | Métricas del dashboard |
| `GET`  | `/api/analytics/chart` | Datos de gráficos (7D/30D/90D) |
| `GET`  | `/api/activity` | Feed de actividad reciente |
| `GET`  | `/api/campaigns` | Campañas |
| `GET`  | `/api/leads` | Leads (formato Kanban) |
| `GET`  | `/api/threads` | Hilos de bandeja de entrada |
| `GET`  | `/api/calendar` | Días del calendario |
| `GET`  | `/api/templates/quick` | Templates de respuesta rápida |

---

## Cómo funciona la automatización

### Conexión de cuenta (cookie `li_at`)

1. El usuario abre LinkedIn en su navegador
2. Abre DevTools (F12) → Application → Cookies → `www.linkedin.com`
3. Copia el valor de la cookie `li_at`
4. Lo pega en la app → el backend valida la sesión con Playwright
5. Si es válida, se guarda en SQLite (cifrada localmente)

### Publicaciones programadas

- Se guardan en la DB con `status = 'scheduled'` y `scheduled_at`
- El cron job corre **cada minuto** y publica los posts que ya están en hora
- La publicación real ocurre vía Playwright: abre LinkedIn, hace click en "Nueva publicación", tipea el texto con velocidad humana, y envía

### Modo seguro

Las automatizaciones:
- Usan delays aleatorios entre `ACTION_DELAY_MIN` y `ACTION_DELAY_MAX` ms
- Respetan el límite diario configurado por automatización
- El cron las ejecuta cada 5 minutos en lotes pequeños
- Se detienen si el límite diario está alcanzado

---

## Estructura de archivos

```
backend/
├── server.js                    ← Entry point (Express + Cron)
├── package.json
├── .env                         ← Configuración local (no commitear)
├── .env.example
├── data/
│   └── linkedin_manager.db      ← SQLite (creado automáticamente)
└── src/
    ├── db/
    │   └── index.js             ← Schema y conexión SQLite
    ├── services/
    │   ├── linkedin.js          ← Motor Playwright (core)
    │   └── queue.js             ← Cola de jobs + scheduler
    └── routes/
        ├── accounts.js          ← /api/accounts
        ├── posts.js             ← /api/posts
        ├── automations.js       ← /api/automations
        └── analytics.js        ← /api/metrics, /api/leads, etc.
```

---

## Próximos pasos

1. **Warm-up de sesión**: al conectar una cuenta, el bot visita el feed unos minutos para "calentar" la sesión antes de automatizar
2. **Proxy rotativo**: para múltiples cuentas, usar proxies diferentes por cuenta
3. **Notificaciones**: webhook o email cuando una automatización falla o alcanza el límite
4. **Panel de control de bot**: ver en tiempo real qué está haciendo cada browser session
