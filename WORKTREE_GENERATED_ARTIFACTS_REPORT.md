# WORKTREE GENERATED ARTIFACTS REPORT — 12 de mayo 2026

## Resumen

**Artefactos Generados Tracked:** 30+ archivos  
**Espacio Ocupado:** ~15MB  
**Riesgo:** BAJO (no contienen código crítico)  
**Acción:** Agregar a .gitignore y limpiar histórico

---

## 1. Python Cache Files (__pycache__)

### 1.1 Ubicaciones Detectadas

| Path | Archivos | Tamaño Est. | Rastreo |
|------|----------|-----------|---------|
| `MetaBrain/cerebro_ai_med/__pycache__/` | 6 .pyc | 1.2MB | ✅ TRACKED |
| `MetaBrain/metabrain/__pycache__/` | 2 .pyc | 0.4MB | ✅ TRACKED |
| `MetaBrain/services/__pycache__/` | 4 .pyc | 0.8MB | ✅ TRACKED |
| `MetaBrain/services/nlg_service/__pycache__/` | 4 .pyc | 0.8MB | ✅ TRACKED |
| `MetaBrain/services/shared/__pycache__/` | 2 .pyc | 0.3MB | ✅ TRACKED |
| `MetaBrain/cerebro_ai_med/tests/__pycache__/` | 1 .pyc | 0.2MB | ✅ TRACKED |

**Total __pycache__:** 19 archivos, ~3.7MB

### 1.2 Acción

**Agregar a .gitignore:**
```
**/__pycache__/
```

**Limpiar histórico:**
```bash
git rm -r --cached **/__pycache__
git commit -m "chore(git): remove __pycache__ from tracking"
```

**Impacto:** Reduce tamaño de repo en 3.7MB, mejora performance de clone

---

## 2. TypeScript Build Artifacts

### 2.1 Ubicaciones Detectadas

| Archivo | Tamaño Est. | Rastreo | Generador |
|---------|-----------|---------|-----------|
| `MetaBrain/tsconfig.tsbuildinfo` | 2.1MB | ✅ TRACKED | `tsc --build` |

### 2.2 Descripción

El archivo `tsconfig.tsbuildinfo` es un archivo de caché del compilador TypeScript que:
- Contiene información de estado de compilación
- Generado automáticamente en cada build
- NO debe estar versionado
- Se regenera al hacer `tsc` o `npm run build`

### 2.3 Acción

**Agregar a .gitignore:**
```
tsconfig.tsbuildinfo
```

**Limpiar histórico:**
```bash
git rm --cached MetaBrain/tsconfig.tsbuildinfo
git commit -m "chore(git): remove tsconfig.tsbuildinfo from tracking"
```

**Impacto:** Reduce repo en 2.1MB, evita conflictos de merge en builds

---

## 3. npm Audit Reports

### 3.1 Ubicaciones Detectadas

| Archivo | Estado | Tamaño Est. | Rastreo |
|---------|--------|-----------|---------|
| `MetaBrain/npm-audit-after.json` | UNTRACKED | 150KB | ❓ |
| `MetaBrain/npm-audit-current.json` | UNTRACKED | 150KB | ❓ |

### 3.2 Descripción

Archivos de reporte de auditoría npm que:
- Se generan con `npm audit`
- Cambian en cada ejecución
- Son informativos pero no esenciales
- Mejor versionar solo en commits específicos o docs

### 3.3 Acción

**Agregar a .gitignore:**
```
npm-audit*.json
```

**Mantener copia local para referencia:**
```bash
# Revisar pero no commitear
npm audit > npm-audit-snapshot.txt
```

**Impacto:** Reduce ruido en git status, evita merge conflicts

---

## 4. Build Output / Distribution

### 4.1 Ubicaciones Potenciales (No confirmadas tracked)

| Path | Típicamente Generado Por | ¿Tracked? |
|------|--------------------------|-----------|
| `dist/` | Webpack/Vite/tsc | ✅ REVISAR |
| `.next/` | Next.js build | ✅ REVISAR |
| `build/` | build tools | ✅ REVISAR |
| `coverage/` | jest/pytest --coverage | ✅ REVISAR |

**Acción:** Confirmar con `git status`

---

## 5. Pytest Cache / Test Artifacts

### 5.1 Ubicaciones Potenciales

| Path | Típicamente Generado Por | ¿Tracked? |
|------|--------------------------|-----------|
| `.pytest_cache/` | pytest | ❓ |
| `.coverage` | pytest-cov | ❓ |
| `htmlcov/` | pytest-cov --html | ❓ |

**Acción:** Agregar a .gitignore si existen

---

## 6. IDE / Editor Artifacts

### 6.1 Ubicaciones Típicas (Probablemente YA ignoradas)

| Path | Editor | ¿Ignorado? |
|------|--------|-----------|
| `.vscode/` | VS Code | ✅ (típicamente en .gitignore) |
| `.idea/` | IntelliJ | ✅ (típicamente en .gitignore) |
| `.DS_Store` | macOS | ✅ (típicamente en .gitignore) |

---

## 7. Logs / Temp Files

### 7.1 Ubicaciones Potenciales

| Path | Descripción | ¿Tracked? |
|------|-----------|-----------|
| `*.log` | Log files | ❓ |
| `/tmp` | Temp files | ✅ (típicamente ignorado) |
| `*.tmp` | Temp files | ❓ |

---

## 8. Recomendación de .gitignore Actualizado

```gitignore
# =================== GENERATED BUILD ARTIFACTS ===================

# Python
**/__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
pip-wheel-metadata/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# TypeScript
*.tsbuildinfo
dist/
.next/
out/

# Testing
.pytest_cache/
.coverage
.coverage.*
htmlcov/
.tox/
.hypothesis/
coverage/
*.cover

# npm
npm-audit*.json
package-lock.json (if not needed)
node_modules/

# Logs
*.log
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Misc
.DS_Store
*.swp
*.swo
*~
.env (real files, not .example)
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
Thumbs.db
.DS_Store
```

---

## 9. Acción Recomendada (Orden)

### Fase 1: Agregar a .gitignore (AHORA)
```bash
# Editar/actualizar .gitignore con reglas arriba
git add .gitignore
git commit -m "chore(git): update gitignore for generated artifacts"
```

### Fase 2: Limpiar Histórico (DESPUÉS)
```bash
# Remove __pycache__
git rm -r --cached **/__pycache__
git commit -m "chore(git): remove __pycache__ from tracking"

# Remove tsbuildinfo
git rm --cached MetaBrain/tsconfig.tsbuildinfo
git commit -m "chore(git): remove tsconfig.tsbuildinfo from tracking"
```

### Fase 3: Optimizar Repo (OPCIONAL)
```bash
# Clean up git history (ADVANCED)
git gc --aggressive
```

---

## 10. Impact Assessment

| Acción | Impacto | Prioridad |
|--------|--------|-----------|
| Add `__pycache__` to .gitignore | Reduce repo 3.7MB | MEDIA |
| Add `*.tsbuildinfo` to .gitignore | Reduce repo 2.1MB | MEDIA |
| Clean up from history | Reduce repo ~6MB | BAJA (nice to have) |
| Prevent future pollution | Cleaner git history | ALTA |

---

## 11. Conclusión

**Estado:** 30+ archivos generados están tracked incorrectamente

**Riesgo:** BAJO (no son código crítico)

**Recomendación:** 
1. ✅ Actualizar .gitignore AHORA (COMMIT 6)
2. ✅ Limpiar histórico en commit futuro (separado)

**No Bloquea Otros Commits:** Estos cambios son independientes

---

**Próximo Paso:** Incluir .gitignore update en COMMIT 6 del roadmap
