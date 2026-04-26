# ✅ CHECKLIST: OPTIMIZACIÓN DE FRONTEND + REESTRUCTURACIÓN ARQUITECTÓNICA

## FASE 1: LIMPIEZA INMEDIATA (HECHO ✓)
- [x] Eliminar .tox/
- [x] Eliminar Lib/
- [x] Crear .gitignore mejorado

## FASE 2: REESTRUCTURACIÓN DE CARPETAS
[ ] **Crear estructura backend/frontend**
  [ ] Crear carpeta `/backend` en raíz
  [ ] Mover `api/` → `backend/api/`
  [ ] Mover `brain/` → `backend/brain/`
  [ ] Mover `whatsapp_gateway/` → `backend/whatsapp_gateway/`
  [ ] Mover `shared/` → `backend/shared/`
  [ ] Mover `tests/` → `backend/tests/`
  [ ] Mover `alembic/` → `backend/alembic/`
  [ ] Mover `scripts/` → `backend/scripts/`
  [ ] Mover `requirements.txt` → `backend/requirements.txt`
  [ ] Mover `pytest.ini` → `backend/pytest.ini`
  [ ] Mover `tox.ini` → `backend/tox.ini`
  [ ] Mover `.venv/` → `backend/.venv/`

[ ] **Consolidar frontends**
  [ ] Decidir cuál mantener: `dashboard-ui` o `frontend`
  [ ] (Recomendación: mantener `dashboard-ui` que es más completo)
  [ ] Copiar componentes útiles del otro si faltan
  [ ] Eliminar frontend duplicado

## FASE 3: OPTIMIZAR VITE CONFIG
- [x] Crear vite.config.ts con:
  - [x] manualChunks (vendedores separados)
  - [x] alias paths (@pages, @components, etc.)
  - [x] optimizeDeps (pre-bundling)
  - [x] build optimization (terser, reportCompressedSize)

## FASE 4: REORGANIZAR COMPONENTES
[ ] Crear estructura de carpetas por features:
  [ ] `src/components/Common/` (Header, Footer, Layout, etc.)
  [ ] `src/components/Dashboard/` (Métricas, Stats, Appointments)
  [ ] `src/components/Telemetry/` (Queue, Health, Performance)
  [ ] `src/components/Alerts/` (AlertPanel, AlertHistory)
  [ ] `src/components/Settings/` (BotConfig, BotLessons, Prefs)
  [ ] `src/components/Modals/` (TeachBotModal, ConfirmDialog)
  [ ] `src/components/Auth/` (RequireAuth, LoginForm)
  [ ] `src/components/Charts/` (Wrappers de Recharts)

[ ] Crear barrel exports (index.ts) en cada carpeta

[ ] Crear LoadingFallback component para Suspense

## FASE 5: IMPLEMENTAR LAZY LOADING
[ ] Reemplazar App.tsx con versión con lazy() + Suspense
  [ ] LoginPage → lazy import
  [ ] DashboardPage → lazy import
  [ ] SettingsPage → lazy import
  [ ] NotFoundPage → lazy import

[ ] Implementar React.lazy en componentes pesados:
  [ ] MetricsChart
  [ ] QueueMonitor
  [ ] AlertPanel
  [ ] BotConfig
  [ ] TeachBotModal

[ ] Reemplazar DashboardPage con versión tab-based:
  [ ] Tab 1: Overview (siempre cargado)
  [ ] Tab 2: Telemetry (lazy + Suspense)
  [ ] Tab 3: Settings (lazy + Suspense)

## FASE 6: AJUSTES EN package.json
[ ] Verificar dependencias:
  - Remover "build" package (yarn/npm install)
  - Asegurar que todas las dependencies están listadas
  - Remover duplicados

[ ] Añadir scripts útiles:
  ```json
  {
    "build": "tsc -b && vite build && vite preview",
    "build:analyze": "vite build --visualizer",
    "dev": "vite",
    "preview": "vite preview"
  }
  ```

## FASE 7: TESTING & VALIDACIÓN
[ ] Compilar sin errores:
  ```bash
  cd backend && pip install -r requirements.txt
  cd ../dashboard-ui && npm install
  ```

[ ] Build bundle:
  ```bash
  npm run build
  # Verificar que sizes < 500KB por chunk
  ```

[ ] Verificar zero breaking changes:
  [ ] Todas las rutas funcionan
  [ ] Todos los endpoints funcionan
  [ ] Archivos estáticos se sirven correctamente
  [ ] API proxy funciona (/api/...)

[ ] Comparar antes/después:
  ```
  ANTES: 641 kB bundle
  DESPUÉS: ~400-450 kB bundle (31-40% reduction)
  
  ESPERADO:
  - vendor-react: ~120 kB
  - vendor-charts: ~85 kB
  - main: ~45 kB
  - dashboard: ~95 kB
  - telemetry: ~78 kB
  - settings: ~62 kB
  - charts: ~85 kB
  ```

## FASE 8: ACTUALIZAR DOCKER & DEPLOYMENT
[ ] Actualizar Dockerfile del frontend:
  [ ] Cambiar WORKDIR a `/app/frontend`
  [ ] Actualizar COPY paths

[ ] Actualizar docker-compose:
  [ ] Servir desde dist correctamente
  [ ] Proxies de API correctos

[ ] Actualizar CI/CD (si existe):
  [ ] Paths de build

## FASE 9: DOCUMENTACIÓN
[ ] Actualizar README.md:
  - Nueva estructura
  - Cómo correr backend y frontend por separado
  - Build optimization tips

[ ] Crear CONTRIBUTING.md con guía:
  - Dónde agregar componentes
  - Cómo hacer barrel exports
  - Cómo hacer lazy loading

[ ] Eliminar archivos de ejemplo:
  - [ ] App.example.tsx
  - [ ] DashboardPage.example.tsx
  - [ ] ESTRUCTURA_COMPONENTES.md (convertir a docs/)
  - [ ] BARREL_EXPORTS.ts (convertir a docs/)

## FASE 10: LIMPIACOSTAL FINAL
[ ] Remover archivos duplicados/innecesarios:
  [ ] `frontend/` (si es redundante)
  [ ] Archivos de ejemplo (.example.tsx)
  [ ] Archivos temporales

[ ] Commit inicial con nueva estructura

## MONITOREO POST-DEPLOYMENT
[ ] Performance metrics:
  - [ ] Initial load time < 3 segundos
  - [ ] First contentful paint < 1.5s
  - [ ] Lighthouse score > 85

[ ] Error monitoring:
  - [ ] Setup Sentry o similar
  - [ ] Monitorear imports rotos
  - [ ] Verificar lazy load failures

---

## 🎯 ESTIMATED TIME

| Fase | Tiempo | Prioridad |
|------|--------|-----------|
| 1-2 | 30 min | 🔴 AHORA |
| 3-4 | 45 min | 🔴 AHORA |
| 5 | 1 hora | 🟡 Hoy |
| 6-7 | 45 min | 🟡 Hoy |
| 8-10 | 30 min | 🟢 Mañana |

**TOTAL: ~4 horas para optimización completa**

---

## 🚀 COMANDOS ÚTILES DURANTE REFACTOR

```bash
# Limpiar node_modules
rm -rf dashboard-ui/node_modules
npm ci  # Clean install

# Verificar imports
npx madge --circular src/

# Analizar bundle
npm run build:analyze

# Verificar sizes de chunks
ls -lah dist/js/

# Recompilar TypeScript
tsc --noEmit

# Visuualizar tree
tree src/ -L 3
```

---

## ⚠️ RIESGOS & MITIGACIÓN

| Riesgo | Impacto | Mitigación |
|--------|--------|-----------|
| Breaking changes en paths | 🔴 Alto | Actualizar todos los imports gradualmente |
| Lazy load dependencies | 🟡 Medio | Pre-bundle conocidas en optimizeDeps |
| API endpoints cambian | 🔴 Alto | Verificar proxy de desarrollo |
| Componentes no se cargan | 🟡 Medio | Error boundaries y LoadingFallback |

---

## 📊 DESPUÉS DE COMPLETAR

Esperas:
✓ Bundle 30-40% más pequeño
✓ Initial load 2-3 segundos más rápido
✓ Lazy loading de rutas/features
✓ Mejor mantenibilidad del código
✓ Zero breaking changes (en teoría)
✓ Arquitectura clara backend/frontend
