"""Queries SQL útiles para el Bot Knowledge Base.

Útiles para:
- Análisis de ML
- Data Lake
- Debugging
- Reporting
"""

-- ============ CONSULTAS ANALÍTICAS ============

-- 1. TOP 10 Patrones más enseñados (por doctor)
SELECT 
    pattern,
    COUNT(*) as times_taught,
    STRING_AGG(DISTINCT d.name, ', ') as doctors
FROM bot_knowledge_base b
JOIN doctors d ON b.doctor_id = d.id
GROUP BY pattern
ORDER BY times_taught DESC
LIMIT 10;


-- 2. Distribución de categorías por doctor
SELECT 
    d.id,
    d.name,
    category,
    COUNT(*) as count
FROM bot_knowledge_base b
JOIN doctors d ON b.doctor_id = d.id
GROUP BY d.id, d.name, category
ORDER BY d.name, count DESC;


-- 3. Doctores más activos en enseñanza (últimos 30 días)
SELECT 
    d.id,
    d.name,
    COUNT(*) as lessons_created,
    COUNT(DISTINCT DATE(b.created_at)) as days_active
FROM bot_knowledge_base b
JOIN doctors d ON b.doctor_id = d.id
WHERE b.created_at > NOW() - INTERVAL '30 days'
GROUP BY d.id, d.name
ORDER BY lessons_created DESC;


-- 4. Patrones duplicados (misma acción, múltiples patrones)
SELECT 
    correct_action,
    COUNT(DISTINCT pattern) as pattern_count,
    STRING_AGG(DISTINCT '"' || pattern || '"', ', ') as patterns,
    category
FROM bot_knowledge_base
GROUP BY correct_action, category
HAVING COUNT(DISTINCT pattern) > 1
ORDER BY pattern_count DESC;


-- 5. Últimas lecciones creadas (para monitoreo)
SELECT 
    b.id,
    b.pattern,
    b.correct_action,
    b.category,
    d.name as doctor_name,
    b.created_at
FROM bot_knowledge_base b
JOIN doctors d ON b.doctor_id = d.id
ORDER BY b.created_at DESC
LIMIT 20;


-- ============ CONSULTAS DE VALIDACIÓN ============

-- 6. Verificar integridad: doctores sin lecciones
SELECT 
    d.id,
    d.name,
    COUNT(b.id) as lesson_count
FROM doctors d
LEFT JOIN bot_knowledge_base b ON d.id = b.doctor_id
GROUP BY d.id, d.name
HAVING COUNT(b.id) = 0
ORDER BY d.name;


-- 7. Doctores inactivos pero con lecciones antiguas (>1 año)
SELECT 
    d.id,
    d.name,
    COUNT(b.id) as old_lessons,
    MAX(b.created_at) as last_lesson_date
FROM doctors d
JOIN bot_knowledge_base b ON d.id = b.doctor_id
WHERE b.created_at < NOW() - INTERVAL '1 year'
GROUP BY d.id, d.name
ORDER BY last_lesson_date ASC;


-- ============ CONSULTAS DE LIMPIEZA/MANTENIMIENTO ============

-- 8. Patrones duplicados por doctor (violaciones de índice)
-- Si hay duplicados aquí, indica problema en la app
SELECT 
    doctor_id,
    pattern,
    COUNT(*) as count
FROM bot_knowledge_base
GROUP BY doctor_id, pattern
HAVING COUNT(*) > 1;


-- 9. Lecciones huérfanas (doctor eliminado)
-- Si existen, hay ruptura de FK
SELECT b.*
FROM bot_knowledge_base b
LEFT JOIN doctors d ON b.doctor_id = d.id
WHERE d.id IS NULL;


-- 10. Actualizar timestamps de lecciones antiguas
UPDATE bot_knowledge_base
SET updated_at = created_at
WHERE updated_at IS NULL;


-- ============ QUERIES PARA ML/ENTRENAMIENTO ============

-- 11. Exportar dataset de entrenamiento (CSV-ready)
SELECT 
    pattern as INPUT,
    correct_action as OUTPUT,
    category as LABEL,
    b.created_at as TIMESTAMP,
    CASE WHEN b.updated_at != b.created_at THEN 'refined' ELSE 'original' END as STATUS
FROM bot_knowledge_base b
ORDER BY b.created_at DESC;


-- 12. Ground truth por categoría (para validación de modelo)
SELECT 
    category,
    COUNT(*) as samples,
    MIN(LENGTH(pattern)) as min_pattern_len,
    AVG(LENGTH(pattern)) as avg_pattern_len,
    MAX(LENGTH(pattern)) as max_pattern_len
FROM bot_knowledge_base
GROUP BY category
ORDER BY samples DESC;


-- 13. Patrones con múltiples acciones posibles (ambigüedad)
-- Puede indicar necesidad de refinamiento
SELECT 
    pattern,
    COUNT(DISTINCT correct_action) as action_variance,
    STRING_AGG(DISTINCT '"' || correct_action || '"', ' | ') as actions
FROM bot_knowledge_base
GROUP BY pattern
HAVING COUNT(DISTINCT correct_action) > 1
ORDER BY action_variance DESC;


-- ============ JSON EXPORT (si usas JSONB) ============

-- 14. Exportar como JSON para pipelines externos
SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
        'id', b.id::TEXT,
        'pattern', b.pattern,
        'action', b.correct_action,
        'category', b.category,
        'doctor_id', b.doctor_id::TEXT,
        'created_at', b.created_at,
        'doctor_name', d.name
    )
)
FROM bot_knowledge_base b
JOIN doctors d ON b.doctor_id = d.id
WHERE b.created_at > NOW() - INTERVAL '7 days';


-- ============ ÍNDICES ADICIONALES RECOMENDADOS ============

-- Para mejorar búsquedas full-text futuras:
-- CREATE INDEX idx_pattern_gin ON bot_knowledge_base 
--   USING GIN (to_tsvector('spanish', pattern));

-- Para búsquedas por timestamp:
-- CREATE INDEX idx_created_at_desc ON bot_knowledge_base 
--   (created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- B-tree para range queries por creación:
-- CREATE INDEX idx_created_range ON bot_knowledge_base 
--   (doctor_id, created_at DESC);

print("✓ Queries de análisis y ML preparadas")
