# LinkedIn Manager — Founder Edition

Plataforma de gestión y automatización de LinkedIn orientada a founders B2B en LATAM. Frontend puro (Vanilla JS + HTML + CSS) con arquitectura lista para conectar un backend Python.

## Stack

- **Frontend**: HTML + CSS + Vanilla JS (ES Modules nativos)
- **Sin build step**: no requiere npm, webpack, vite ni nada. Se abre con un servidor estático.
- **Estética**: Dark Mode premium + Glassmorphism + acentos neón (azul #4f8cff, púrpura #a855f7, cyan #22d3ee)

## Estructura

```
linkedin-manager/
├── index.html                 # Shell principal (sidebar + topbar + container)
├── src/
│   ├── styles/
│   │   ├── main.css           # Design system, layout, variables CSS
│   │   └── components.css     # Estilos de componentes (cards, kanban, inbox, etc.)
│   ├── data/
│   │   └── mock.js            # Datos simulados (reemplazar con API real)
│   └── js/
│       ├── main.js            # Router + bootstrap
│       ├── ui.js              # Helpers compartidos (toast)
│       ├── services/
│       │   └── api.js         # Capa de servicios — único punto de contacto con el backend
│       └── views/
│           ├── dashboard.js   # Métricas, chart SVG, feed de actividad
│           ├── campaigns.js   # Grid de campañas con steps y stats
│           ├── inbox.js       # Smart Inbox con filtros y templates
│           ├── leads.js       # Kanban de leads con drag & drop
│           └── content.js     # Calendario + próximos posts
└── README.md
```

## Cómo ejecutar

Como usa ES Modules, hay que servirlo con un servidor estático (no se puede abrir con `file://`).

### Opción 1 — Python (ya lo tenés instalado)
```bash
cd C:/Users/slevin/projects/linkedin-manager
python -m http.server 8080
```
Abrir http://localhost:8080

### Opción 2 — VS Code Live Server
Click derecho sobre `index.html` → "Open with Live Server"

### Opción 3 — Node.js
```bash
npx serve .
```

## Navegación

| Vista | Shortcut | Descripción |
|-------|----------|-------------|
| Dashboard | `#dashboard` | Métricas clave, chart semanal, feed de actividad |
| Campañas | `#campaigns` | Secuencias automatizadas de outreach |
| Inbox | `#inbox` | Bandeja centralizada con templates rápidos |
| Leads CRM | `#leads` | Pipeline Kanban con drag & drop |
| Contenido | `#content` | Calendario de posts programados |

**Shortcut global**: `Ctrl+K` (Windows) / `Cmd+K` (Mac) enfoca el buscador.

## Cómo conectar el backend Python

Todo el código habla con el backend a través de `src/js/services/api.js`. Para migrar de mock a API real:

1. Abrir `src/js/services/api.js`
2. Cambiar `USE_MOCK = false`
3. Ajustar `API_BASE` al URL de tu backend (ej. `http://localhost:8000/api`)
4. Los endpoints que el backend debe exponer están documentados como comentarios en cada función

Ejemplo de endpoints esperados:
```
GET  /api/metrics
GET  /api/analytics/weekly
GET  /api/activity
GET  /api/campaigns
POST /api/campaigns/:id/toggle
GET  /api/threads?filter=all
POST /api/threads/:id/messages
GET  /api/leads
POST /api/leads/:id/move
GET  /api/posts/scheduled
GET  /api/calendar
```

### Sugerencia de stack backend

- **FastAPI** (Python) + **Puppeteer/Playwright** (Node o Python) para la automatización real de LinkedIn
- **Scraping/automatización**: Playwright-Python (más estable que los clientes no oficiales de la API)
- **Persistencia**: SQLite o PostgreSQL según volumen
- **Auth**: JWT simple (es single-user al principio)

## Roadmap

- [ ] Editor visual de campañas (constructor drag & drop)
- [ ] Integración backend Python con Playwright
- [ ] Bulk actions sobre leads
- [ ] Composer de posts con preview de LinkedIn
- [ ] Analytics comparativos mes a mes
- [ ] Exportar reportes a PDF/Sheets (reusando scripts existentes)

## Paleta & tokens de diseño

Todos los tokens están en `src/styles/main.css` como custom properties bajo `:root`. Ajustar ahí cualquier color, radio, o escala.

---

Creado para Sebastián Levin · Care Assistance · LATAM 🌎
