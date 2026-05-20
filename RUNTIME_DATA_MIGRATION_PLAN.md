# RUNTIME DATA MIGRATION PLAN
Generated: 2026-05-19 00:14:29 -03:00
Mode: PLAN ONLY (no apply)

Canonical target root: E:\GSentinelRuntime

## Canonical directories to create
```
E:\GSentinelRuntime\artifacts
E:\GSentinelRuntime\uploads
E:\GSentinelRuntime\logs
E:\GSentinelRuntime\cache
E:\GSentinelRuntime\ml
E:\GSentinelRuntime\temp
E:\GSentinelRuntime\redis
E:\GSentinelRuntime\postgres
E:\GSentinelRuntime\observability
E:\GSentinelRuntime\ml\checkpoints
E:\GSentinelRuntime\ml\datasets
E:\GSentinelRuntime\ml\embeddings
E:\GSentinelRuntime\ml\vectorstore
E:\GSentinelRuntime\ml\inference-cache
E:\GSentinelRuntime\ml\training-cache

```
## Detected runtime/data/artifact references in repo
```
docker-compose.yml:252:      REDIS_CACHE_PREFIX: ${REDIS_CACHE_PREFIX:-cache:}
docker-compose.yml:278:      - uploads_data:/data/uploads
docker-compose.yml:319:      REDIS_CACHE_PREFIX: ${REDIS_CACHE_PREFIX:-cache:}
docker-compose.yml:333:      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
docker-compose.yml:340:      - uploads_data:/data/uploads
docker-compose.yml:341:      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
docker-compose.yml:391:      - uploads_data:/data/uploads
docker-compose.yml:462:      MEDICAL_CHAT_LEARNING_PATH: /app/artifacts/mb-chat-learning/medical-chat-learning.jsonl
docker-compose.yml:469:      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
docker-compose.yml:576:      REDIS_CACHE_PREFIX: ${REDIS_CACHE_PREFIX:-cache:}
docker-compose.yml:627:      REDIS_CACHE_PREFIX: ${REDIS_CACHE_PREFIX:-cache:}
docker-compose.yml:678:      REDIS_CACHE_PREFIX: ${REDIS_CACHE_PREFIX:-cache:}
docker-compose.yml:984:  uploads_data:
MB-Secretaria\.gitignore:8:__pycache__/
MB-Secretaria\.gitignore:19:# Cobertura y logs
api\tests\test_runtime_startup_lab.py:39:    # Fuerza reload para evitar cache de settings previos del proceso de tests.
brain\interpreters\nlu_engine.py:27:    cached_at: datetime = field(default_factory=datetime.utcnow)
brain\interpreters\nlu_engine.py:42:    """In-memory cache de lecciones por doctor con TTL."""
brain\interpreters\nlu_engine.py:45:        self._cache: dict[str, list[CachedLesson]] = {}
brain\interpreters\nlu_engine.py:49:        if doctor_id not in self._cache:
brain\interpreters\nlu_engine.py:51:        lessons = self._cache[doctor_id]
brain\interpreters\nlu_engine.py:55:        cached_time = lessons[0].cached_at
brain\interpreters\nlu_engine.py:56:        if datetime.utcnow() - cached_time > self._ttl:
brain\interpreters\nlu_engine.py:57:            del self._cache[doctor_id]
brain\interpreters\nlu_engine.py:62:        self._cache[doctor_id] = lessons
brain\interpreters\nlu_engine.py:66:            self._cache.pop(doctor_id, None)
brain\interpreters\nlu_engine.py:68:            self._cache.clear()
brain\interpreters\nlu_engine.py:127:    _lesson_cache: LessonCache = LessonCache(ttl_seconds=300)
brain\interpreters\nlu_engine.py:266:            cached = cls._lesson_cache.get(doctor_id)
brain\interpreters\nlu_engine.py:267:            if cached is None:
brain\interpreters\nlu_engine.py:284:                            cls._lesson_cache.set(doctor_id, lessons)
brain\interpreters\nlu_engine.py:288:                lessons = cached
brain\interpreters\nlu_engine.py:360:    def clear_knowledge_cache(cls, doctor_id: Optional[str] = None) -> None:
brain\interpreters\nlu_engine.py:361:        cls._lesson_cache.clear(doctor_id)
brain\tests\test_brain_entrypoint_contract_integration.py:25:                "inference_cached": False,
scripts\analyze_k6_summary.py:5:    python scripts/analyze_k6_summary.py artifacts/qa/k6_slot_booking_summary.json
scripts\audit_logs_sensitive.py:1:"""Audita archivos de log o salida de docker logs en busca de datos sensibles.
scripts\audit_logs_sensitive.py:4:    python scripts/audit_logs_sensitive.py --path /var/log/gsentinel/ --ext .log
scripts\audit_logs_sensitive.py:6:Uso contra docker logs en vivo:
scripts\audit_logs_sensitive.py:7:    docker logs sentinel-api 2>&1 | python scripts/audit_logs_sensitive.py --stdin
scripts\audit_logs_sensitive.py:10:    python scripts/audit_logs_sensitive.py --docker sentinel-api sentinel-brain sentinel-gateway
scripts\audit_logs_sensitive.py:64:        description="Firma HMAC completa de Meta en logs (no debería loguearse entera)",
scripts\audit_logs_sensitive.py:70:        description="Clave maestra de cifrado en logs",
scripts\audit_logs_sensitive.py:76:        description="JWT_SECRET en logs",
scripts\audit_logs_sensitive.py:88:        description="DNI/Cédula en logs (revisar si es necesario para diagnóstico)",
scripts\audit_logs_sensitive.py:94:        description="Email de paciente en payload JSON completo en logs",
scripts\audit_logs_sensitive.py:155:            ["docker", "logs", "--tail", "5000", container],
scripts\audit_logs_sensitive.py:166:        print(f"  ⚠ Timeout leyendo logs de {container}", file=sys.stderr)
scripts\audit_logs_sensitive.py:180:        print("\n✅  Auditoría completada: no se encontraron datos sensibles en logs.\n")
scripts\audit_logs_sensitive.py:218:    parser = argparse.ArgumentParser(description="Auditoría de logs: datos sensibles")
scripts\audit_logs_sensitive.py:220:    group.add_argument("--path", type=str, help="Directorio o archivo de logs")
scripts\audit_logs_sensitive.py:221:    group.add_argument("--stdin", action="store_true", help="Leer de stdin (pipe de docker logs)")
scripts\audit_logs_sensitive.py:239:            print(f"Analizando logs de contenedor: {container}", file=sys.stderr)
scripts\audit_logs_sensitive.py:258:        # Por defecto: escanear logs del proyecto actual si existen
scripts\audit_logs_sensitive.py:259:        default_log_dirs = [Path("logs"), Path("/var/log/gsentinel")]
scripts\audit_logs_sensitive.py:268:                "No se especificó fuente de logs y no se encontró directorio 'logs/'.\n"
scripts\audit_logs_sensitive.py:269:                "Uso: python scripts/audit_logs_sensitive.py --help",
scripts\backup-production-state.sh:28:docker logs --tail=200 sentinel-gateway > "$BACKUP_DIR/sentinel-gateway.logs.txt" 2>&1 || true
scripts\backfill_clinic_id.py:35:    "audit_logs",
brain\app.py:118:    inference_cached: bool
brain\app.py:406:                inference_cached=False,
scripts\deploy-gateway-safe.sh:33:BAD_LOGS="$(docker logs --tail=200 sentinel-gateway 2>&1 | grep -E 'localhost:6379|127\.0\.0\.1:6379|redis://redis-master:6379|sentinel-sentinel|MasterNotFoundError|Name or service not known|Firma invalida|Firma inválida|403 Forbidden' || true)"
scripts\deploy-gateway-safe.sh:35:  echo "ERROR: logs del gateway contienen errores prohibidos"
scripts\deploy-gateway-safe.sh:40:docker logs --tail=50 sentinel-gateway
scripts\deploy-prod-safe.sh:12:LOG_DIR="$PROJECT_DIR/deploy-logs"
scripts\deploy-prod-safe.sh:158:  if ! git diff --cached --quiet; then
scripts\deploy-prod-safe.sh:162:  if [ -n "$(git ls-files --others --exclude-standard -- ':!deploy-logs' ':!deploy-logs/*')" ]; then
scripts\deploy-prod-safe.sh:452:      echo "----- logs: $svc -----"
scripts\deploy-prod-safe.sh:453:      docker compose -f "$COMPOSE_FILE" logs --tail=40 "$svc" 2>&1 | sanitize_output || true
scripts\deploy_bot_knowledge.ps1:184:Write-Host "  3. Verifica logs en [api] knowledge.py"
scripts\deploy_vps.sh:83:echo "  1. Verificar logs:   docker compose -f $COMPOSE_FILE logs -f --tail=50"
scripts\deploy_vps.sh:85:echo "  3. Auditoría logs:   python scripts/audit_logs_sensitive.py --docker gs_api gs_brain gs_gateway"
scripts\deploy_medical_agenda_domain.sh:65:    "${DC[@]}" -f "${COMPOSE_FILE}" logs --tail=80 web >&2 || true
MB-Secretaria\data\synthetic_dataset\incidents.json:16:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:60:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:109:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:154:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:196:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:236:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:287:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:332:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:383:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:424:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:468:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:515:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:561:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:605:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:646:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:688:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:734:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:781:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:826:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:871:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:916:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:962:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1008:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1048:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1090:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1132:        "logs": [],
MB-Secretaria\data\synthetic_dataset\incidents.json:1170:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1213:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1253:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1299:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1342:        "logs": [],
MB-Secretaria\data\synthetic_dataset\incidents.json:1380:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1425:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1469:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1512:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1558:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1602:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1649:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1690:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1732:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1773:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1819:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1863:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1904:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1951:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:1998:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2041:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2083:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2130:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2177:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2221:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2267:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2313:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2358:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2408:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2450:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2492:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2542:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2589:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2636:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2682:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2727:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2774:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2822:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2866:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2908:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:2957:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3001:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3050:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3099:        "logs": [],
MB-Secretaria\data\synthetic_dataset\incidents.json:3137:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3187:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3237:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3284:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3332:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3379:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3424:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3469:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3517:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3560:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3600:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3650:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3699:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3743:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3787:        "logs": [],
MB-Secretaria\data\synthetic_dataset\incidents.json:3825:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3874:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3917:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:3964:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4008:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4058:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4104:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4149:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4196:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4246:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4289:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4337:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4383:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4428:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4477:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4518:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4565:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4611:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4658:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4703:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4748:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4794:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4838:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4883:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4924:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:4973:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5021:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5069:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5117:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5168:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5215:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5259:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5306:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5357:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5403:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5451:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5495:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5541:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5588:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5636:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5684:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5732:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5776:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5819:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5868:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5911:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:5959:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6005:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6050:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6098:        "logs": [],
MB-Secretaria\data\synthetic_dataset\incidents.json:6136:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6180:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6223:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6271:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6318:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6365:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6408:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6460:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6510:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6558:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6607:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6651:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6696:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6742:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6783:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6828:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6870:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6917:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:6968:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7016:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7063:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7110:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7160:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7208:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7256:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7301:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7341:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7391:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7435:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7483:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7530:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7576:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7621:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7666:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7710:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7755:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7804:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7846:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7890:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7932:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:7977:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8023:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8069:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8119:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8162:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8204:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8250:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8297:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8340:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8386:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8433:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8479:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8525:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8573:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8619:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8670:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8711:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8754:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8801:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8848:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8895:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8942:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:8987:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9029:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9075:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9122:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9167:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9213:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9255:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9304:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9346:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9389:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9435:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9486:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9534:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9582:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9624:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9671:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9719:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9770:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9818:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9869:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9910:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:9960:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10003:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10051:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10098:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10147:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10200:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10245:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10292:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10337:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10384:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10428:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10473:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10521:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10567:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10613:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10656:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10700:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10748:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10798:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10845:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10892:        "logs": [
MB-Secretaria\data\synthetic_dataset\incidents.json:10940:        "logs": [
api\tests\admin\test_panel_admin.py:164:    def test_get_audit_logs_without_key_returns_403(self):
api\tests\admin\test_panel_admin.py:166:            r = client.get("/api/v1/admin/panel/audit-logs")
MB-Secretaria\models\feature_importance_ranking.csv:22:logs_count,0.02214022140221402,2.214022140221402
MB-Secretaria\models\feature_importance_ranking.csv:24:logs_count_normalized,0.02214022140221402,2.214022140221402
MB-Secretaria\models\feature_importance.json:176:      "feature": "logs_count_normalized",
MB-Secretaria\models\feature_importance.json:194:      "feature": "logs_count",
brain\main.py:128:                await state_manager.incr_metric("messages_processed_total")
brain\KNOWLEDGE_BASE_INTEGRATION.md:30:├─ 1. Obtener lecciones (cache o API)
brain\KNOWLEDGE_BASE_INTEGRATION.md:32:│     └─ APIClient.get_bot_lessons() → Si no en cache
brain\KNOWLEDGE_BASE_INTEGRATION.md:69:✓ Método clear_knowledge_cache()
brain\KNOWLEDGE_BASE_INTEGRATION.md:185:Buscar logs con `[Knowledge]`:
brain\KNOWLEDGE_BASE_INTEGRATION.md:190:[Knowledge] Obtenidas 45 lecciones desde cache
brain\KNOWLEDGE_BASE_INTEGRATION.md:231:cache = NLUEngine._lesson_cache
brain\KNOWLEDGE_BASE_INTEGRATION.md:232:cache_ttl = 300  # 5 minutos (default)
brain\KNOWLEDGE_BASE_INTEGRATION.md:245:3. Nueva data cacheada
brain\KNOWLEDGE_BASE_INTEGRATION.md:248:### Limpiar cache (si es necesario)
brain\KNOWLEDGE_BASE_INTEGRATION.md:252:NLUEngine.clear_knowledge_cache(doctor_id)
brain\KNOWLEDGE_BASE_INTEGRATION.md:255:NLUEngine.clear_knowledge_cache()
brain\KNOWLEDGE_BASE_INTEGRATION.md:279:async def test_cache_ttl():
brain\KNOWLEDGE_BASE_INTEGRATION.md:280:    # Verificar que cache expira
brain\KNOWLEDGE_BASE_INTEGRATION.md:281:    cache = LessonCache(ttl_seconds=1)
brain\KNOWLEDGE_BASE_INTEGRATION.md:282:    cache.set("doc", [lesson])
brain\KNOWLEDGE_BASE_INTEGRATION.md:285:    assert cache.get("doc") is None
brain\KNOWLEDGE_BASE_INTEGRATION.md:307:1. Buscar en cache: hit ✓
brain\KNOWLEDGE_BASE_INTEGRATION.md:368:1. ¿Cache expirado? → `NLUEngine.clear_knowledge_cache(doctor_id)`
brain\KNOWLEDGE_BASE_INTEGRATION.md:369:2. ¿API retorna lecciones? → Check logs `[Knowledge]`
brain\KNOWLEDGE_BASE_INTEGRATION.md:406:  latency: < 50ms      (cache hit)
MB-Secretaria\data\processed\feature_names_optimized.txt:14:logs_count
MB-Secretaria\data\processed\feature_names_optimized.txt:17:logs_count_normalized
MB-Secretaria\data\processed\feature_names.txt:14:logs_count
MB-Secretaria\data\processed\feature_names.txt:17:logs_count_normalized
scripts\docker_safe_cleanup.sh:4:# cache de build y redes no usadas. NUNCA borra volumenes ni datos persistentes.
scripts\docker_safe_cleanup.sh:40:echo "=== Limpieza segura: build cache antiguo (>=24h) ==="
scripts\diagnose-whatsapp.sh:30:echo "== Gateway logs =="
scripts\diagnose-whatsapp.sh:31:docker logs --tail=80 sentinel-gateway || true
scripts\qa_google_db_consistency.py:134:        return build("calendar", "v3", credentials=creds, cache_discovery=False)
scripts\qa_google_calendar_load.py:128:        return build("calendar", "v3", credentials=creds, cache_discovery=False)
scripts\qa_google_calendar_integration.py:93:    return build("calendar", "v3", credentials=creds, cache_discovery=False)
MB-Secretaria\data\model-registry.json:11:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache"],
MB-Secretaria\data\model-registry.json:24:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache", "scale_up"],
MB-Secretaria\data\processed\X_val.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Secretaria\data\processed\X_train_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
scripts\process_notification_outbox.py:24:            f"Outbox processed={summary['processed']} sent={summary['sent']} failed={summary['failed']}"
scripts\process_google_outbox.py:24:            f"Google outbox processed={summary['processed']} done={summary['done']} failed={summary['failed']}"
api\app\services\patient_service.py:42:    """Registra un acceso PHI en patient_access_logs (fire-and-forget, no bloquea)."""
MB-Secretaria\data\processed\X_train_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
api\app\services\outbox_service.py:294:            (processed, success)
api\app\services\outbox_service.py:322:            item.processed_at = cast(Any, datetime.utcnow())
api\app\services\outbox_service.py:396:            item.processed_at = cast(Any, datetime.utcnow())
api\app\services\outbox_service.py:440:        processed = 0
api\app\services\outbox_service.py:443:            item_processed, success = await self.process_claimed_google_item(item_id)
api\app\services\outbox_service.py:444:            if not item_processed:
api\app\services\outbox_service.py:446:            processed += 1
api\app\services\outbox_service.py:452:        return {"processed": processed, "done": done, "failed": failed}
api\app\services\outbox_service.py:508:        return {"processed": len(pending), "sent": sent, "failed": failed}
scripts\perf_appointments_latency.py:7:3) Google async latency: google_outbox create flow time (created_at -> processed_at)
scripts\perf_appointments_latency.py:242:        SELECT id, status, retries, processed_at
scripts\perf_appointments_latency.py:273:            EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000 AS latency_ms
scripts\perf_appointments_latency.py:278:          AND processed_at IS NOT NULL
scripts\perf_appointments_latency.py:290:            SELECT created_at, processed_at
scripts\perf_appointments_latency.py:295:              AND processed_at IS NOT NULL
scripts\perf_appointments_latency.py:304:            processed_at = row.get("processed_at")
scripts\perf_appointments_latency.py:305:            if created_at is None or processed_at is None:
scripts\perf_appointments_latency.py:309:            if isinstance(processed_at, str):
scripts\perf_appointments_latency.py:310:                processed_at = datetime.fromisoformat(processed_at)
scripts\perf_appointments_latency.py:311:            delta = processed_at - created_at
MB-Secretaria\data\processed\X_train.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Secretaria\data\processed\X_test_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
api\app\services\google_calendar_service.py:319:        return build("calendar", "v3", credentials=creds, cache_discovery=False)
api\app\services\google_calendar_service.py:354:        return build("calendar", "v3", credentials=creds, cache_discovery=False)
MB-Secretaria\data\processed\X_test_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Secretaria\models\anomaly_model_metadata.json:21:    "logs_count",
MB-Secretaria\data\processed\X_test.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
scripts\k6_slot_booking_load.js:13:const SUMMARY_PATH = __ENV.K6_SUMMARY_JSON || "artifacts/qa/k6_slot_booking_summary.json";
MB-Secretaria\data\processed\sequence_metadata.json:20:    "logs_count",
MB-Secretaria\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Secretaria\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
api\app\schemas\dashboard_schema.py:14:    messages_processed: int = Field(0, description="Total de mensajes procesados")
MB-Secretaria\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Secretaria\data\processed\feature_names_top80_importance.txt:21:logs_count
MB-Secretaria\data\processed\feature_names_top80_importance.txt:23:logs_count_normalized
scripts\qa_postgres_slot_buffer_incremental.py:51:        default="artifacts/qa",
scripts\qa_postgres_slot_buffer_concurrency.py:931:                "transaction_logs": [trace.__dict__ for trace in traces],
scripts\vps_healthcheck.sh:191:UPLOADS_VOLUME="$(docker volume ls --filter 'label=com.docker.compose.volume=uploads_data' --format '{{.Name}}' | head -n1)"
scripts\vps_healthcheck.sh:193:  echo "  ⚠ ALERTA: no se encontro volumen con label uploads_data."
MB-Secretaria\models\feature_selection_report.json:42:    "logs_count",
MB-Secretaria\models\feature_selection_report.json:44:    "logs_count_normalized",
MB-Secretaria\models\feature_names.txt:14:logs_count
MB-Secretaria\models\feature_names.txt:17:logs_count_normalized
MB-Secretaria\models\model_dl_metadata.json:18:    "logs_count",
MB-Secretaria\models\model_dl_metadata.json:21:    "logs_count_normalized",
MB-Secretaria\models\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\src\persistence\schemas\online-training-buffer.schema.ts:34:   * Exact ONNX feature vector used in inference (float32 array)
MB-Whatsapp\retrieval\index.ts:24:  notes: ["MetaBrain Nest usa embeddings hash; Next usa allowlist y sanitizer."],
MB-Whatsapp\README.md:25:   - Features enriquecidas: severity, logs_count, metrics_count, frequency, encodings categóricos
MB-Whatsapp\README.md:119:**Contexto** (4): logs_count, metrics_count, has_data, source_category
MB-Whatsapp\README.md:200:data/processed/
MB-Whatsapp\README.md:270:3. **Model Registry** (`scripts/model_registry.py`)
MB-Whatsapp\README.md:334:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\README.md:338:python scripts/demo_model_registry.py
MB-Whatsapp\README.md:375:tail -f logs/app.log | grep "COMBINED_SCORE"
MB-Whatsapp\README.md:378:tail -f logs/app.log | grep "ESCALATE"
MB-Whatsapp\README.md:381:grep "ML_ACCURACY_RECORD" logs/app.log | head -20
MB-Whatsapp\README.md:386:# Visible en logs:
MB-Whatsapp\README.md:387:tail -f logs/app.log | grep "Learning.*Retraining"
MB-Whatsapp\README.md:397:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\README.md:404:python scripts/demo_model_registry.py
MB-Whatsapp\memory\vector-backend.contract.ts:4:  embedding: number[];
MB-Whatsapp\memory\vector-backend.contract.ts:13:  backend: "pgvector" | "qdrant" | "local_vector" | "future_provider";
MB-Whatsapp\memory\vector-backend.contract.ts:17:  upsert_vector(entry: MemoryEntry, embedding: number[]): Promise<void>;
MB-Whatsapp\memory\vector-backend.contract.ts:18:  vector_search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
MB-Whatsapp\memory\vector-backend.contract.ts:24:  allowedFutureBackends: ["pgvector", "qdrant", "local_vector"],
MB-Whatsapp\memory\vector-backend.contract.ts:25:  note: "Contract only. No vector database dependency or runtime activation is introduced in Phase 3.",
MB-Whatsapp\memory\types.ts:102:  vectorEnabled: boolean;
MB-Whatsapp\memory\types.ts:133:  retrieval_mode: "disabled" | "lexical_jsonl" | "future_vector";
MB-Whatsapp\memory\README.md:20:- Prepare future pgvector or Qdrant integration without adding dependencies.
MB-Whatsapp\memory\README.md:35:- No external embedding provider is called.
MB-Chat\src\ml-service\metrics.service.ts:33:  private readonly cacheHits = new Counter({
MB-Chat\src\ml-service\metrics.service.ts:34:    name: 'ml_service_cache_hits_total',
MB-Chat\src\ml-service\metrics.service.ts:35:    help: 'Total number of cache hits',
MB-Chat\src\ml-service\metrics.service.ts:38:  private readonly cacheMisses = new Counter({
MB-Chat\src\ml-service\metrics.service.ts:39:    name: 'ml_service_cache_misses_total',
MB-Chat\src\ml-service\metrics.service.ts:40:    help: 'Total number of cache misses',
MB-Chat\src\ml-service\metrics.service.ts:90:    this.cacheHits.inc();
MB-Chat\src\ml-service\metrics.service.ts:94:    this.cacheMisses.inc();
MB-Chat\src\ml-service\metrics.service.ts:130:      cache: {
MB-Whatsapp\memory\jsonl-memory-adapter.ts:174:        embedding_slot: record.embedding_slot,
MB-Whatsapp\memory\index.ts:8:export * from "./vector-backend.contract";
MB-Whatsapp\memory\index.ts:15:  vectorBackend: "contract_only",
MB-Whatsapp\providers_py\types.py:9:ProviderRequestType = Literal["chat", "completion", "embedding", "vision", "multimodal", "healthcheck"]
MB-Secretaria\data\incidents.json:16:        "logs": [
MB-Secretaria\data\incidents.json:60:        "logs": [
MB-Secretaria\data\incidents.json:109:        "logs": [
MB-Secretaria\data\incidents.json:154:        "logs": [
MB-Secretaria\data\incidents.json:196:        "logs": [
MB-Secretaria\data\incidents.json:236:        "logs": [
MB-Secretaria\data\incidents.json:287:        "logs": [
MB-Secretaria\data\incidents.json:332:        "logs": [
MB-Secretaria\data\incidents.json:383:        "logs": [
MB-Secretaria\data\incidents.json:424:        "logs": [
MB-Secretaria\data\incidents.json:468:        "logs": [
MB-Secretaria\data\incidents.json:515:        "logs": [
MB-Secretaria\data\incidents.json:561:        "logs": [
MB-Secretaria\data\incidents.json:605:        "logs": [
MB-Secretaria\data\incidents.json:646:        "logs": [
MB-Secretaria\data\incidents.json:688:        "logs": [
MB-Secretaria\data\incidents.json:734:        "logs": [
MB-Secretaria\data\incidents.json:781:        "logs": [
MB-Secretaria\data\incidents.json:826:        "logs": [
MB-Secretaria\data\incidents.json:871:        "logs": [
MB-Secretaria\data\incidents.json:916:        "logs": [
MB-Secretaria\data\incidents.json:962:        "logs": [
MB-Secretaria\data\incidents.json:1008:        "logs": [
MB-Secretaria\data\incidents.json:1048:        "logs": [
MB-Secretaria\data\incidents.json:1090:        "logs": [
MB-Secretaria\data\incidents.json:1132:        "logs": [],
MB-Secretaria\data\incidents.json:1170:        "logs": [
MB-Secretaria\data\incidents.json:1213:        "logs": [
MB-Secretaria\data\incidents.json:1253:        "logs": [
MB-Secretaria\data\incidents.json:1299:        "logs": [
MB-Secretaria\data\incidents.json:1342:        "logs": [],
MB-Secretaria\data\incidents.json:1380:        "logs": [
MB-Secretaria\data\incidents.json:1425:        "logs": [
MB-Secretaria\data\incidents.json:1469:        "logs": [
MB-Secretaria\data\incidents.json:1512:        "logs": [
MB-Secretaria\data\incidents.json:1558:        "logs": [
MB-Secretaria\data\incidents.json:1602:        "logs": [
MB-Secretaria\data\incidents.json:1649:        "logs": [
MB-Secretaria\data\incidents.json:1690:        "logs": [
MB-Secretaria\data\incidents.json:1732:        "logs": [
MB-Secretaria\data\incidents.json:1773:        "logs": [
MB-Secretaria\data\incidents.json:1819:        "logs": [
MB-Secretaria\data\incidents.json:1863:        "logs": [
MB-Secretaria\data\incidents.json:1904:        "logs": [
MB-Secretaria\data\incidents.json:1951:        "logs": [
MB-Secretaria\data\incidents.json:1998:        "logs": [
MB-Secretaria\data\incidents.json:2041:        "logs": [
MB-Secretaria\data\incidents.json:2083:        "logs": [
MB-Secretaria\data\incidents.json:2130:        "logs": [
MB-Secretaria\data\incidents.json:2177:        "logs": [
MB-Secretaria\data\incidents.json:2221:        "logs": [
MB-Secretaria\data\incidents.json:2267:        "logs": [
MB-Secretaria\data\incidents.json:2313:        "logs": [
MB-Secretaria\data\incidents.json:2358:        "logs": [
MB-Secretaria\data\incidents.json:2408:        "logs": [
MB-Secretaria\data\incidents.json:2450:        "logs": [
MB-Secretaria\data\incidents.json:2492:        "logs": [
MB-Secretaria\data\incidents.json:2542:        "logs": [
MB-Secretaria\data\incidents.json:2589:        "logs": [
MB-Secretaria\data\incidents.json:2636:        "logs": [
MB-Secretaria\data\incidents.json:2682:        "logs": [
MB-Secretaria\data\incidents.json:2727:        "logs": [
MB-Secretaria\data\incidents.json:2774:        "logs": [
MB-Secretaria\data\incidents.json:2822:        "logs": [
MB-Secretaria\data\incidents.json:2866:        "logs": [
MB-Secretaria\data\incidents.json:2908:        "logs": [
MB-Secretaria\data\incidents.json:2957:        "logs": [
MB-Secretaria\data\incidents.json:3001:        "logs": [
MB-Secretaria\data\incidents.json:3050:        "logs": [
MB-Secretaria\data\incidents.json:3099:        "logs": [],
MB-Secretaria\data\incidents.json:3137:        "logs": [
MB-Secretaria\data\incidents.json:3187:        "logs": [
MB-Secretaria\data\incidents.json:3237:        "logs": [
MB-Secretaria\data\incidents.json:3284:        "logs": [
MB-Secretaria\data\incidents.json:3332:        "logs": [
MB-Secretaria\data\incidents.json:3379:        "logs": [
MB-Secretaria\data\incidents.json:3424:        "logs": [
MB-Secretaria\data\incidents.json:3469:        "logs": [
MB-Secretaria\data\incidents.json:3517:        "logs": [
MB-Secretaria\data\incidents.json:3560:        "logs": [
MB-Secretaria\data\incidents.json:3600:        "logs": [
MB-Secretaria\data\incidents.json:3650:        "logs": [
MB-Secretaria\data\incidents.json:3699:        "logs": [
MB-Secretaria\data\incidents.json:3743:        "logs": [
MB-Secretaria\data\incidents.json:3787:        "logs": [],
MB-Secretaria\data\incidents.json:3825:        "logs": [
MB-Secretaria\data\incidents.json:3874:        "logs": [
MB-Secretaria\data\incidents.json:3917:        "logs": [
MB-Secretaria\data\incidents.json:3964:        "logs": [
MB-Secretaria\data\incidents.json:4008:        "logs": [
MB-Secretaria\data\incidents.json:4058:        "logs": [
MB-Secretaria\data\incidents.json:4104:        "logs": [
MB-Secretaria\data\incidents.json:4149:        "logs": [
MB-Secretaria\data\incidents.json:4196:        "logs": [
MB-Secretaria\data\incidents.json:4246:        "logs": [
MB-Secretaria\data\incidents.json:4289:        "logs": [
MB-Secretaria\data\incidents.json:4337:        "logs": [
MB-Secretaria\data\incidents.json:4383:        "logs": [
MB-Secretaria\data\incidents.json:4428:        "logs": [
MB-Secretaria\data\incidents.json:4477:        "logs": [
MB-Secretaria\data\incidents.json:4518:        "logs": [
MB-Secretaria\data\incidents.json:4565:        "logs": [
MB-Secretaria\data\incidents.json:4611:        "logs": [
MB-Secretaria\data\incidents.json:4658:        "logs": [
MB-Secretaria\data\incidents.json:4703:        "logs": [
MB-Secretaria\data\incidents.json:4748:        "logs": [
MB-Secretaria\data\incidents.json:4794:        "logs": [
MB-Secretaria\data\incidents.json:4838:        "logs": [
MB-Secretaria\data\incidents.json:4883:        "logs": [
MB-Secretaria\data\incidents.json:4924:        "logs": [
MB-Secretaria\data\incidents.json:4973:        "logs": [
MB-Secretaria\data\incidents.json:5021:        "logs": [
MB-Secretaria\data\incidents.json:5069:        "logs": [
MB-Secretaria\data\incidents.json:5117:        "logs": [
MB-Secretaria\data\incidents.json:5168:        "logs": [
MB-Secretaria\data\incidents.json:5215:        "logs": [
MB-Secretaria\data\incidents.json:5259:        "logs": [
MB-Secretaria\data\incidents.json:5306:        "logs": [
MB-Secretaria\data\incidents.json:5357:        "logs": [
MB-Secretaria\data\incidents.json:5403:        "logs": [
MB-Secretaria\data\incidents.json:5451:        "logs": [
MB-Secretaria\data\incidents.json:5495:        "logs": [
MB-Secretaria\data\incidents.json:5541:        "logs": [
MB-Secretaria\data\incidents.json:5588:        "logs": [
MB-Secretaria\data\incidents.json:5636:        "logs": [
MB-Secretaria\data\incidents.json:5684:        "logs": [
MB-Secretaria\data\incidents.json:5732:        "logs": [
MB-Secretaria\data\incidents.json:5776:        "logs": [
MB-Secretaria\data\incidents.json:5819:        "logs": [
MB-Secretaria\data\incidents.json:5868:        "logs": [
MB-Secretaria\data\incidents.json:5911:        "logs": [
MB-Secretaria\data\incidents.json:5959:        "logs": [
MB-Secretaria\data\incidents.json:6005:        "logs": [
MB-Secretaria\data\incidents.json:6050:        "logs": [
MB-Secretaria\data\incidents.json:6098:        "logs": [],
MB-Secretaria\data\incidents.json:6136:        "logs": [
MB-Secretaria\data\incidents.json:6180:        "logs": [
MB-Secretaria\data\incidents.json:6223:        "logs": [
MB-Secretaria\data\incidents.json:6271:        "logs": [
MB-Secretaria\data\incidents.json:6318:        "logs": [
MB-Secretaria\data\incidents.json:6365:        "logs": [
MB-Secretaria\data\incidents.json:6408:        "logs": [
MB-Secretaria\data\incidents.json:6460:        "logs": [
MB-Secretaria\data\incidents.json:6510:        "logs": [
MB-Secretaria\data\incidents.json:6558:        "logs": [
MB-Secretaria\data\incidents.json:6607:        "logs": [
MB-Secretaria\data\incidents.json:6651:        "logs": [
MB-Secretaria\data\incidents.json:6696:        "logs": [
MB-Secretaria\data\incidents.json:6742:        "logs": [
MB-Secretaria\data\incidents.json:6783:        "logs": [
MB-Secretaria\data\incidents.json:6828:        "logs": [
MB-Secretaria\data\incidents.json:6870:        "logs": [
MB-Secretaria\data\incidents.json:6917:        "logs": [
MB-Secretaria\data\incidents.json:6968:        "logs": [
MB-Secretaria\data\incidents.json:7016:        "logs": [
MB-Secretaria\data\incidents.json:7063:        "logs": [
MB-Secretaria\data\incidents.json:7110:        "logs": [
MB-Secretaria\data\incidents.json:7160:        "logs": [
MB-Secretaria\data\incidents.json:7208:        "logs": [
MB-Secretaria\data\incidents.json:7256:        "logs": [
MB-Secretaria\data\incidents.json:7301:        "logs": [
MB-Secretaria\data\incidents.json:7341:        "logs": [
MB-Secretaria\data\incidents.json:7391:        "logs": [
MB-Secretaria\data\incidents.json:7435:        "logs": [
MB-Secretaria\data\incidents.json:7483:        "logs": [
MB-Secretaria\data\incidents.json:7530:        "logs": [
MB-Secretaria\data\incidents.json:7576:        "logs": [
MB-Secretaria\data\incidents.json:7621:        "logs": [
MB-Secretaria\data\incidents.json:7666:        "logs": [
MB-Secretaria\data\incidents.json:7710:        "logs": [
MB-Secretaria\data\incidents.json:7755:        "logs": [
MB-Secretaria\data\incidents.json:7804:        "logs": [
MB-Secretaria\data\incidents.json:7846:        "logs": [
MB-Secretaria\data\incidents.json:7890:        "logs": [
MB-Secretaria\data\incidents.json:7932:        "logs": [
MB-Secretaria\data\incidents.json:7977:        "logs": [
MB-Secretaria\data\incidents.json:8023:        "logs": [
MB-Secretaria\data\incidents.json:8069:        "logs": [
MB-Secretaria\data\incidents.json:8119:        "logs": [
MB-Secretaria\data\incidents.json:8162:        "logs": [
MB-Secretaria\data\incidents.json:8204:        "logs": [
MB-Secretaria\data\incidents.json:8250:        "logs": [
MB-Secretaria\data\incidents.json:8297:        "logs": [
MB-Secretaria\data\incidents.json:8340:        "logs": [
MB-Secretaria\data\incidents.json:8386:        "logs": [
MB-Secretaria\data\incidents.json:8433:        "logs": [
MB-Secretaria\data\incidents.json:8479:        "logs": [
MB-Secretaria\data\incidents.json:8525:        "logs": [
MB-Secretaria\data\incidents.json:8573:        "logs": [
MB-Secretaria\data\incidents.json:8619:        "logs": [
MB-Secretaria\data\incidents.json:8670:        "logs": [
MB-Secretaria\data\incidents.json:8711:        "logs": [
MB-Secretaria\data\incidents.json:8754:        "logs": [
MB-Secretaria\data\incidents.json:8801:        "logs": [
MB-Secretaria\data\incidents.json:8848:        "logs": [
MB-Secretaria\data\incidents.json:8895:        "logs": [
MB-Secretaria\data\incidents.json:8942:        "logs": [
MB-Secretaria\data\incidents.json:8987:        "logs": [
MB-Secretaria\data\incidents.json:9029:        "logs": [
MB-Secretaria\data\incidents.json:9075:        "logs": [
MB-Secretaria\data\incidents.json:9122:        "logs": [
MB-Secretaria\data\incidents.json:9167:        "logs": [
MB-Secretaria\data\incidents.json:9213:        "logs": [
MB-Secretaria\data\incidents.json:9255:        "logs": [
MB-Secretaria\data\incidents.json:9304:        "logs": [
MB-Secretaria\data\incidents.json:9346:        "logs": [
MB-Secretaria\data\incidents.json:9389:        "logs": [
MB-Secretaria\data\incidents.json:9435:        "logs": [
MB-Secretaria\data\incidents.json:9486:        "logs": [
MB-Secretaria\data\incidents.json:9534:        "logs": [
MB-Secretaria\data\incidents.json:9582:        "logs": [
MB-Secretaria\data\incidents.json:9624:        "logs": [
MB-Secretaria\data\incidents.json:9671:        "logs": [
MB-Secretaria\data\incidents.json:9719:        "logs": [
MB-Secretaria\data\incidents.json:9770:        "logs": [
MB-Secretaria\data\incidents.json:9818:        "logs": [
MB-Secretaria\data\incidents.json:9869:        "logs": [
MB-Secretaria\data\incidents.json:9910:        "logs": [
MB-Secretaria\data\incidents.json:9960:        "logs": [
MB-Secretaria\data\incidents.json:10003:        "logs": [
MB-Secretaria\data\incidents.json:10051:        "logs": [
MB-Secretaria\data\incidents.json:10098:        "logs": [
MB-Secretaria\data\incidents.json:10147:        "logs": [
MB-Secretaria\data\incidents.json:10200:        "logs": [
MB-Secretaria\data\incidents.json:10245:        "logs": [
MB-Secretaria\data\incidents.json:10292:        "logs": [
MB-Secretaria\data\incidents.json:10337:        "logs": [
MB-Secretaria\data\incidents.json:10384:        "logs": [
MB-Secretaria\data\incidents.json:10428:        "logs": [
MB-Secretaria\data\incidents.json:10473:        "logs": [
MB-Secretaria\data\incidents.json:10521:        "logs": [
MB-Secretaria\data\incidents.json:10567:        "logs": [
MB-Secretaria\data\incidents.json:10613:        "logs": [
MB-Secretaria\data\incidents.json:10656:        "logs": [
MB-Secretaria\data\incidents.json:10700:        "logs": [
MB-Secretaria\data\incidents.json:10748:        "logs": [
MB-Secretaria\data\incidents.json:10798:        "logs": [
MB-Secretaria\data\incidents.json:10845:        "logs": [
MB-Secretaria\data\incidents.json:10892:        "logs": [
MB-Secretaria\data\incidents.json:10940:        "logs": [
MB-Whatsapp\memory\feature-flags.ts:6:  vectorEnabled: false,
MB-Whatsapp\memory\feature-flags.ts:35:    vectorEnabled: readBoolean(env.SEMANTIC_MEMORY_VECTOR_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.vectorEnabled),
MB-Chat\src\ml-core\feature-builder.ts:42:  'logs_count',
MB-Chat\src\ml-core\feature-builder.ts:45:  'logs_count_normalized',
MB-Chat\src\ml-core\feature-builder.ts:122:    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];
MB-Chat\src\ml-core\feature-builder.ts:149:    byName.logs_count = logs.length;
MB-Chat\src\ml-core\feature-builder.ts:152:    byName.logs_count_normalized = this.clamp(logs.length / 50);
MB-Chat\src\ml-core\feature-builder.ts:177:    const vector = this.metadata.feature_names.map((name) => this.ensureNumeric(byName[name]));
MB-Chat\src\ml-core\feature-builder.ts:179:    if (vector.length !== this.metadata.num_features) {
MB-Chat\src\ml-core\feature-builder.ts:181:        `Feature length mismatch: expected ${this.metadata.num_features}, got ${vector.length}`,
MB-Chat\src\ml-core\feature-builder.ts:185:    return vector;
MB-Chat\src\ml-core\feature-builder.ts:202:  /** Returns the zero-based index of a feature name in the model's feature vector, or -1 if not found. */
api\app\observability\health_metrics.py:15:    processed = brain_metrics.get("messages_processed_total") or 0
api\app\observability\health_metrics.py:25:    lock_contention_ratio = (lock_contentions / processed) if processed > 0 else 0.0
api\app\observability\health_metrics.py:26:    reset_ratio = (resets / processed) if processed > 0 else 0.0
api\app\observability\health_metrics.py:33:            "lock_contention_per_processed": round(lock_contention_ratio, 4),
api\app\observability\health_metrics.py:34:            "system_reset_per_processed": round(reset_ratio, 4),
api\app\models\models.py:63:    __tablename__ = "patient_access_logs"
api\app\models\models.py:81:    # ID de trazabilidad del request (correlación con logs de observabilidad)
api\app\models\models.py:89:        Index("ix_patient_access_logs_timestamp", "timestamp"),
api\app\models\models.py:90:        Index("ix_patient_access_logs_patient_id", "patient_id"),
api\app\models\models.py:91:        Index("ix_patient_access_logs_accessor_id", "accessor_id"),
api\app\models\models.py:94:            name="ck_patient_access_logs_type_valid",
api\app\models\models.py:284:    processed_at = Column(DateTime, nullable=True)
api\app\models\admin_models.py:1:"""Modelos SQLAlchemy para el Panel Super-Admin: audit logs y feature flags."""
api\app\models\admin_models.py:17:    __tablename__ = "admin_audit_logs"
api\app\models\admin_models.py:39:        Index("ix_admin_audit_logs_timestamp", "timestamp"),
api\app\models\admin_models.py:40:        Index("ix_admin_audit_logs_actor_id", "actor_id"),
api\app\models\admin_models.py:41:        Index("ix_admin_audit_logs_action", "action"),
MB-Chat\src\ml\online-learning.service.ts:18: * - FASE 4: Incremental dataset generation + retraining
MB-Chat\src\ml\online-learning.service.ts:128:      // Step 2: Export incremental dataset from buffer
MB-Chat\src\ml\online-learning.service.ts:131:        `[OnlineLearning] Exported incremental dataset: ${incrementalDataPath}`,
brain\orchestration\session_manager.py:14:    "cached_intent": str | None,
brain\orchestration\session_manager.py:15:    "cached_context_hash": str | None,   # hash del contexto al momento del cache
brain\orchestration\session_manager.py:16:    "cached_inference": dict | None,
brain\orchestration\session_manager.py:17:    "cached_decision": dict | None,
brain\orchestration\session_manager.py:20:El cache es VÁLIDO solo si:
brain\orchestration\session_manager.py:21:  1. cached_intent == intent actual
brain\orchestration\session_manager.py:22:  2. cached_context_hash == hash del contexto actual
brain\orchestration\session_manager.py:205:        (session_id, timestamps, etc.) para no invalidar el cache innecesariamente.
brain\orchestration\session_manager.py:216:        return hashlib.md5(serialized.encode()).hexdigest()[:12]  # noqa: S324 — solo identificador de cache
brain\orchestration\session_manager.py:220:    async def get_cached_analysis(
brain\orchestration\session_manager.py:226:        """Retorna (inference_output, decision_output) si el cache es válido.
brain\orchestration\session_manager.py:228:        El cache se considera INVÁLIDO (retorna None) si:
brain\orchestration\session_manager.py:231:          - No hay datos cacheados.
brain\orchestration\session_manager.py:235:            state.get("cached_intent") == intent
brain\orchestration\session_manager.py:236:            and state.get("cached_context_hash") == context_hash
brain\orchestration\session_manager.py:237:            and state.get("cached_inference") is not None
brain\orchestration\session_manager.py:238:            and state.get("cached_decision") is not None
brain\orchestration\session_manager.py:246:            return state["cached_inference"], state["cached_decision"]
brain\orchestration\session_manager.py:248:        if state.get("cached_intent") == intent and state.get("cached_context_hash") != context_hash:
brain\orchestration\session_manager.py:254:                state.get("cached_context_hash"),
brain\orchestration\session_manager.py:259:    async def store_cached_analysis(
brain\orchestration\session_manager.py:269:        existing_state["cached_intent"] = intent
brain\orchestration\session_manager.py:270:        existing_state["cached_context_hash"] = context_hash
brain\orchestration\session_manager.py:271:        existing_state["cached_inference"] = inference_output
brain\orchestration\session_manager.py:272:        existing_state["cached_decision"] = decision_output
MB-Chat\src\ml\model.service.ts:45:   * @param features Enriched feature vector with learning-based signals
brain\orchestration\semantic_memory.py:47:        index_dir: str = "artifacts/semantic_index",
brain\orchestration\semantic_memory.py:60:        """Genera embedding float32 normalizado.
brain\orchestration\semantic_memory.py:62:        Usa OpenAI embeddings si OPENAI_API_KEY esta disponible.
brain\orchestration\semantic_memory.py:63:        Si falla, cae a embedding local hash-based para no romper el flujo.
brain\orchestration\semantic_memory.py:85:            "model": "text-embedding-3-small",
brain\orchestration\semantic_memory.py:96:                    "https://api.openai.com/v1/embeddings",
brain\orchestration\semantic_memory.py:103:            logger.warning("OpenAI embeddings fallback a local: %s", exc)
brain\orchestration\semantic_memory.py:106:        embedding = data.get("data", [{}])[0].get("embedding")
brain\orchestration\semantic_memory.py:107:        if not isinstance(embedding, list) or not embedding:
brain\orchestration\semantic_memory.py:110:        vec = np.array(embedding, dtype=np.float32)
brain\orchestration\semantic_memory.py:113:                "Dimension embeddings inesperada (%s). Esperada=%s",
brain\orchestration\semantic_memory.py:143:                vector = await self.embed(cleaned)
brain\orchestration\semantic_memory.py:147:                    best_score, _ = self._search_index(index, vector, top_k=1)
brain\orchestration\semantic_memory.py:151:                self._add_to_index(index, vector)
brain\orchestration\semantic_memory.py:154:                vector_key = self._vectors_key(session_id)
brain\orchestration\semantic_memory.py:160:                await self.redis.rpush(vector_key, json.dumps(vector.tolist()))
brain\orchestration\semantic_memory.py:164:                await self.redis.ltrim(vector_key, -self.max_records, -1)
brain\orchestration\semantic_memory.py:169:                    await self.redis.expire(vector_key, self.ttl_seconds)
brain\orchestration\semantic_memory.py:235:                    # Similitud semántica (FAISS usa inner product en vectores normalizados = cosine)
brain\orchestration\semantic_memory.py:288:        raw_vectors = await self.redis.lrange(self._vectors_key(session_id), 0, -1)
brain\orchestration\semantic_memory.py:290:        vectors: List[np.ndarray] = []
brain\orchestration\semantic_memory.py:291:        for item in raw_vectors:
brain\orchestration\semantic_memory.py:304:            vectors.append(vec)
brain\orchestration\semantic_memory.py:306:        if vectors:
brain\orchestration\semantic_memory.py:307:            matrix = np.vstack(vectors).astype(np.float32)
brain\orchestration\semantic_memory.py:331:            redis_count = int(await self.redis.llen(self._vectors_key(session_id)))
brain\orchestration\semantic_memory.py:393:    def _add_to_index(self, index, vector: np.ndarray) -> None:
brain\orchestration\semantic_memory.py:395:            index.add(vector.reshape(1, -1).astype(np.float32))
brain\orchestration\semantic_memory.py:397:        index.append(vector)
brain\orchestration\semantic_memory.py:441:    def _vectors_key(session_id: str) -> str:
brain\orchestration\semantic_memory.py:442:        return f"semantic_memory:{session_id}:vectors"
MB-Whatsapp\providers\types.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
MB-Secretaria\models\v12\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v12\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v12\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v12\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Secretaria\models\v12\metrics.json:50:    "logs_count",
MB-Secretaria\models\v12\metrics.json:53:    "logs_count_normalized",
MB-Secretaria\models\v12\feature_names.txt:14:logs_count
MB-Secretaria\models\v12\feature_names.txt:17:logs_count_normalized
MB-Secretaria\models\v10\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v10\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v10\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v10\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Secretaria\models\v10\metrics.json:50:    "logs_count",
MB-Secretaria\models\v10\metrics.json:53:    "logs_count_normalized",
MB-Secretaria\models\v10\feature_names.txt:14:logs_count
MB-Secretaria\models\v10\feature_names.txt:17:logs_count_normalized
brain\orchestration\orchestrator.py:17:    ¿cache válido?   → responder
brain\orchestration\orchestrator.py:23:        ↓ (cachear con context_hash)
brain\orchestration\orchestrator.py:39:  confidence, inference_cached, turn_count,
brain\orchestration\orchestrator.py:106:- Nunca revelar tokens, IDs, URLs internas, logs ni errores técnicos.
brain\orchestration\orchestrator.py:349:                    "inference_cached": False,
brain\orchestration\orchestrator.py:385:                    "inference_cached": False,
brain\orchestration\orchestrator.py:489:                "inference_cached": False,
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:409:    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:410:    expect(logs).toContain('PATIENT_CONTEXT_ACCESS_DENIED');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:433:    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:434:    expect(logs).toContain('PATIENT_CONTEXT_ACCESS_DENIED');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:457:    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:458:    expect(logs).toContain('PROVIDER_PHI_NOT_ALLOWED');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:492:    const logs = loggerErrorSpy.mock.calls.map((call) => String(call[0])).join(' ');
MB-Chat\src\medical-assistant\medical-assistant.service.spec.ts:493:    expect(logs).toContain('INVALID_DOCTOR_PATIENT_CONTEXT');
api\app\eventing\notifications.py:15:        self.processed_repo = ProcessedEventRepository(db)
api\app\eventing\notifications.py:22:        if await self.processed_repo.is_processed(self.consumer_name, event_id):
api\app\eventing\notifications.py:32:        await self.processed_repo.mark_processed(self.consumer_name, event_id)
api\app\eventing\notifications.py:34:        return "processed"
MB-Whatsapp\nlu_engine.py:27:    cached_at: datetime = field(default_factory=datetime.utcnow)
MB-Whatsapp\nlu_engine.py:42:    """In-memory cache de lecciones por doctor con TTL."""
MB-Whatsapp\nlu_engine.py:45:        self._cache: dict[str, list[CachedLesson]] = {}
MB-Whatsapp\nlu_engine.py:49:        if doctor_id not in self._cache:
MB-Whatsapp\nlu_engine.py:51:        lessons = self._cache[doctor_id]
MB-Whatsapp\nlu_engine.py:55:        cached_time = lessons[0].cached_at
MB-Whatsapp\nlu_engine.py:56:        if datetime.utcnow() - cached_time > self._ttl:
MB-Whatsapp\nlu_engine.py:57:            del self._cache[doctor_id]
MB-Whatsapp\nlu_engine.py:62:        self._cache[doctor_id] = lessons
MB-Whatsapp\nlu_engine.py:66:            self._cache.pop(doctor_id, None)
MB-Whatsapp\nlu_engine.py:68:            self._cache.clear()
MB-Whatsapp\nlu_engine.py:127:    _lesson_cache: LessonCache = LessonCache(ttl_seconds=300)
MB-Whatsapp\nlu_engine.py:266:            cached = cls._lesson_cache.get(doctor_id)
MB-Whatsapp\nlu_engine.py:267:            if cached is None:
MB-Whatsapp\nlu_engine.py:284:                            cls._lesson_cache.set(doctor_id, lessons)
MB-Whatsapp\nlu_engine.py:288:                lessons = cached
MB-Whatsapp\nlu_engine.py:360:    def clear_knowledge_cache(cls, doctor_id: Optional[str] = None) -> None:
MB-Whatsapp\nlu_engine.py:361:        cls._lesson_cache.clear(doctor_id)
api\app\eventing\idempotency.py:11:    async def is_processed(self, consumer_name: str, event_id: str) -> bool:
api\app\eventing\idempotency.py:18:                FROM processed_events
api\app\eventing\idempotency.py:28:    async def mark_processed(self, consumer_name: str, event_id: str) -> None:
api\app\eventing\idempotency.py:35:                INSERT INTO processed_events (consumer_name, event_id, processed_at)
MB-Whatsapp\metabrain\prompt_loader.py:35:        self._cache: dict[str, _CachedPrompt] = {}
MB-Whatsapp\metabrain\prompt_loader.py:60:    def clear_cache(self) -> None:
MB-Whatsapp\metabrain\prompt_loader.py:62:            self._cache.clear()
MB-Whatsapp\metabrain\prompt_loader.py:82:            cached = self._cache.get(filename)
MB-Whatsapp\metabrain\prompt_loader.py:83:            if cached is not None and cached.mtime == stat.st_mtime:
MB-Whatsapp\metabrain\prompt_loader.py:84:                return cached.content
MB-Whatsapp\metabrain\prompt_loader.py:99:            self._cache[filename] = _CachedPrompt(mtime=stat.st_mtime, content=content)
MB-Secretaria\models\v11\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v11\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v11\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v11\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Secretaria\models\v11\metrics.json:50:    "logs_count",
MB-Secretaria\models\v11\metrics.json:53:    "logs_count_normalized",
MB-Secretaria\models\v11\feature_names.txt:14:logs_count
MB-Secretaria\models\v11\feature_names.txt:17:logs_count_normalized
api\app\core\phi_policy.py:81:    #: Días de retención para logs de acceso PHI.
MB-Secretaria\models\model_metrics.json:50:    "logs_count",
MB-Secretaria\models\model_metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\metabrain\metrics.py:18:            "cache_hits_total": 0,
MB-Whatsapp\metabrain\metrics.py:19:            "cache_misses_total": 0,
MB-Whatsapp\metabrain\metrics.py:30:    def record_cache_hit(self) -> None:
MB-Whatsapp\metabrain\metrics.py:32:            self._stats["cache_hits_total"] += 1
MB-Whatsapp\metabrain\metrics.py:34:    def record_cache_miss(self) -> None:
MB-Whatsapp\metabrain\metrics.py:36:            self._stats["cache_misses_total"] += 1
MB-Whatsapp\metabrain\metrics.py:66:        cache_lookups = int(snapshot.get("cache_hits_total", 0)) + int(snapshot.get("cache_misses_total", 0))
MB-Whatsapp\metabrain\metrics.py:72:        if cache_lookups > 0:
MB-Whatsapp\metabrain\metrics.py:73:            hit_rate = float(snapshot.get("cache_hits_total", 0)) / float(cache_lookups)
MB-Whatsapp\metabrain\metrics.py:76:        snapshot["cache_hit_rate"] = round(hit_rate, 4)
MB-Whatsapp\metabrain\logger.py:44:    """Emit logs as one JSON object per line."""
MB-Whatsapp\metabrain\groq_client.py:1:"""Production-grade Groq client with secure config, timeout, metrics, and cache."""
MB-Whatsapp\metabrain\groq_client.py:10:from metabrain.cache import GLOBAL_CACHE, InMemoryTTLCache, build_cache_key
MB-Whatsapp\metabrain\groq_client.py:45:    from_cache: bool = False
MB-Whatsapp\metabrain\groq_client.py:56:        cache: InMemoryTTLCache | None = None,
MB-Whatsapp\metabrain\groq_client.py:61:        self._cache = cache or GLOBAL_CACHE
MB-Whatsapp\metabrain\groq_client.py:97:        use_cache: bool = True,
MB-Whatsapp\metabrain\groq_client.py:107:        cache_key = build_cache_key(
MB-Whatsapp\metabrain\groq_client.py:116:        if use_cache:
MB-Whatsapp\metabrain\groq_client.py:117:            cached = self._cache.get(cache_key)
MB-Whatsapp\metabrain\groq_client.py:118:            if cached is not None and isinstance(cached, PromptResponse):
MB-Whatsapp\metabrain\groq_client.py:119:                self._metrics.record_cache_hit()
MB-Whatsapp\metabrain\groq_client.py:121:                    text=cached.text,
MB-Whatsapp\metabrain\groq_client.py:122:                    model=cached.model,
MB-Whatsapp\metabrain\groq_client.py:123:                    latency_ms=cached.latency_ms,
MB-Whatsapp\metabrain\groq_client.py:124:                    prompt_tokens=cached.prompt_tokens,
MB-Whatsapp\metabrain\groq_client.py:125:                    completion_tokens=cached.completion_tokens,
MB-Whatsapp\metabrain\groq_client.py:126:                    total_tokens=cached.total_tokens,
MB-Whatsapp\metabrain\groq_client.py:127:                    from_cache=True,
MB-Whatsapp\metabrain\groq_client.py:129:            self._metrics.record_cache_miss()
MB-Whatsapp\metabrain\groq_client.py:157:                from_cache=False,
MB-Whatsapp\metabrain\groq_client.py:165:            if use_cache:
MB-Whatsapp\metabrain\groq_client.py:166:                self._cache.set(cache_key, prompt_response)
MB-Whatsapp\metabrain\groq_client.py:288:    use_cache: bool = True,
MB-Whatsapp\metabrain\groq_client.py:298:        use_cache=use_cache,
MB-Whatsapp\metabrain\config.py:7:from functools import lru_cache
MB-Whatsapp\metabrain\config.py:67:    nlg_cache_ttl_seconds: int = 300
MB-Whatsapp\metabrain\config.py:68:    nlg_cache_max_entries: int = 256
MB-Whatsapp\metabrain\config.py:90:@lru_cache(maxsize=1)
MB-Whatsapp\metabrain\config.py:126:        nlg_cache_ttl_seconds=_parse_int(
MB-Whatsapp\metabrain\config.py:132:        nlg_cache_max_entries=_parse_int(
MB-Whatsapp\metabrain\config.py:144:    get_settings.cache_clear()
MB-Whatsapp\metabrain\cache.py:1:"""Simple in-memory TTL cache to avoid repeated Groq calls."""
MB-Whatsapp\metabrain\cache.py:22:    """Small process-local cache with TTL + max-size eviction."""
MB-Whatsapp\metabrain\cache.py:72:def build_cache_key(*parts: str) -> str:
MB-Whatsapp\metabrain\cache.py:81:def _get_or_create_global_cache() -> InMemoryTTLCache:
MB-Whatsapp\metabrain\cache.py:87:                max_entries=settings.nlg_cache_max_entries,
MB-Whatsapp\metabrain\cache.py:88:                ttl_seconds=settings.nlg_cache_ttl_seconds,
MB-Whatsapp\metabrain\cache.py:93:GLOBAL_CACHE = _get_or_create_global_cache()
MB-Secretaria\models\v15\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v15\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v15\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v15\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Secretaria\models\v15\metrics.json:50:    "logs_count",
MB-Secretaria\models\v15\metrics.json:53:    "logs_count_normalized",
MB-Chat\src\learning\learning.service.ts:136:        `${pythonCmd} scripts/extract_real_dataset.py`,
MB-Chat\src\learning\learning.service.ts:137:        `${pythonCmd} scripts/data_pipeline.py --input-dir data/production_dataset --output-dir data/processed --dataset-type production`,
MB-Secretaria\models\v15\feature_names.txt:14:logs_count
MB-Secretaria\models\v15\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\memory_py\types.py:43:    vector_enabled: bool = False
MB-Whatsapp\memory_py\semantic_memory_service.py:30:        vector_enabled=_read_bool(values.get("SEMANTIC_MEMORY_VECTOR_ENABLED"), False),
MB-Whatsapp\memory_py\jsonl_adapter.py:158:                "embedding_slot": record.get("embedding_slot"),
MB-Secretaria\models\v14\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v14\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v14\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v14\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Secretaria\models\v14\metrics.json:50:    "logs_count",
MB-Secretaria\models\v14\metrics.json:53:    "logs_count_normalized",
MB-Secretaria\models\v14\feature_names.txt:14:logs_count
MB-Secretaria\models\v14\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\models\feature_selection_report.json:42:    "logs_count",
MB-Whatsapp\models\feature_selection_report.json:44:    "logs_count_normalized",
MB-Chat\src\knowledge\schemas\medical-document.schema.ts:12:  embedding!: number[];
MB-Whatsapp\models\feature_names.txt:14:logs_count
MB-Whatsapp\models\feature_names.txt:17:logs_count_normalized
MB-Chat\src\knowledge\medical-sources.service.ts:23:  private readonly cache = new Map<string, CacheEntry>();
MB-Chat\src\knowledge\medical-sources.service.ts:31:    const cached = this.cache.get(key);
MB-Chat\src\knowledge\medical-sources.service.ts:32:    if (cached && Date.now() < cached.expiresAt) {
MB-Chat\src\knowledge\medical-sources.service.ts:33:      return cached.value;
MB-Chat\src\knowledge\medical-sources.service.ts:48:    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: all });
MB-Chat\src\knowledge\knowledge.retriever.ts:15:  private readonly cache = new Map<string, RetrievalCacheEntry>();
MB-Chat\src\knowledge\knowledge.retriever.ts:27:    const cacheKey = `${query.toLowerCase()}|${country.toUpperCase()}|${topK}`;
MB-Chat\src\knowledge\knowledge.retriever.ts:28:    const cached = this.cache.get(cacheKey);
MB-Chat\src\knowledge\knowledge.retriever.ts:29:    if (cached && Date.now() < cached.expiresAt) {
MB-Chat\src\knowledge\knowledge.retriever.ts:31:        context: this.buildContext(cached.docs),
MB-Chat\src\knowledge\knowledge.retriever.ts:32:        docs: cached.docs,
MB-Chat\src\knowledge\knowledge.retriever.ts:33:        citations: this.toCitations(cached.docs),
MB-Chat\src\knowledge\knowledge.retriever.ts:58:    this.cache.set(cacheKey, {
MB-Whatsapp\models\feature_importance_ranking.csv:22:logs_count,0.02214022140221402,2.214022140221402
MB-Whatsapp\models\feature_importance_ranking.csv:24:logs_count_normalized,0.02214022140221402,2.214022140221402
MB-Chat\src\knowledge\knowledge.module.ts:8:import { EmbeddingService } from './embedding.service';
MB-Whatsapp\models\feature_importance.json:176:      "feature": "logs_count_normalized",
MB-Whatsapp\models\feature_importance.json:194:      "feature": "logs_count",
MB-Chat\src\knowledge\knowledge-index.service.ts:4:import { EmbeddingService } from './embedding.service';
MB-Chat\src\knowledge\knowledge-index.service.ts:26:    private readonly embeddingService: EmbeddingService,
MB-Chat\src\knowledge\knowledge-index.service.ts:36:      const embedding = this.embeddingService.embed(content);
MB-Chat\src\knowledge\knowledge-index.service.ts:44:            embedding,
MB-Chat\src\knowledge\knowledge-index.service.ts:70:    const queryEmbedding = this.embeddingService.embed(query);
MB-Chat\src\knowledge\knowledge-index.service.ts:72:    // Alternative to pgvector: compute cosine in app layer over curated corpus.
MB-Chat\src\knowledge\knowledge-index.service.ts:81:        const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, r.embedding ?? []);
MB-Chat\src\knowledge\embedding.service.ts:7:  // Lightweight local embedding alternative: hashed token embedding.
MB-Chat\src\knowledge\embedding.service.ts:8:  // Avoids external embedding API dependency while enabling semantic-ish retrieval.
MB-Whatsapp\src\common\utils\error-parser.util.ts:17:  const logs = asLowercaseList(input.metadata?.logs);
MB-Whatsapp\src\common\utils\error-parser.util.ts:19:  if (errors.some((entry) => entry.includes('timeout')) && logs.some((entry) => entry.includes('postgres'))) {
MB-Secretaria\models\v13\onnx_metadata.json:23:    "logs_count",
MB-Secretaria\models\v13\onnx_metadata.json:26:    "logs_count_normalized",
MB-Secretaria\models\v13\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Secretaria\models\v13\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\src\common\utils\error-parser.util.spec.ts:14:        logs: ['postgres connection pool exhausted'],
MB-Secretaria\models\v13\metrics.json:50:    "logs_count",
MB-Secretaria\models\v13\metrics.json:53:    "logs_count_normalized",
MB-Secretaria\models\v13\feature_names.txt:14:logs_count
MB-Secretaria\models\v13\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\src\common\types\brain.types.ts:21:  | 'clear_cache'
api\app\api\v1\endpoints\webhooks_whatsapp.py:271:        "whatsapp_webhook_processed",
api\app\api\v1\endpoints\webhooks_whatsapp.py:296:        status="processed",
MB-Whatsapp\src\knowledge\schemas\medical-document.schema.ts:12:  embedding!: number[];
MB-Whatsapp\models\anomaly_model_metadata.json:21:    "logs_count",
MB-Whatsapp\src\knowledge\medical-sources.service.ts:14:  private readonly cache = new Map<string, CacheEntry>();
MB-Whatsapp\src\knowledge\medical-sources.service.ts:22:    const cached = this.cache.get(key);
MB-Whatsapp\src\knowledge\medical-sources.service.ts:23:    if (cached && Date.now() < cached.expiresAt) {
MB-Whatsapp\src\knowledge\medical-sources.service.ts:24:      return cached.value;
MB-Whatsapp\src\knowledge\medical-sources.service.ts:39:    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: all });
api\app\api\v1\endpoints\prometheus_metrics.py:44:        "# HELP gsentinel_api_shadow_executions_total Requests processed in shadow/dry-run mode",
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:15:  private readonly cache = new Map<string, RetrievalCacheEntry>();
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:27:    const cacheKey = `${query.toLowerCase()}|${country.toUpperCase()}|${topK}`;
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:28:    const cached = this.cache.get(cacheKey);
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:29:    if (cached && Date.now() < cached.expiresAt) {
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:31:        context: this.buildContext(cached.docs),
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:32:        docs: cached.docs,
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:33:        citations: this.toCitations(cached.docs),
MB-Whatsapp\src\knowledge\knowledge.retriever.ts:58:    this.cache.set(cacheKey, {
api\app\api\v1\endpoints\panel_admin.py:224:@router.get("/audit-logs")
api\app\api\v1\endpoints\panel_admin.py:225:async def list_panel_audit_logs(
api\app\api\v1\endpoints\panel_admin.py:248:        "logs": [PanelAuditLogEntry.model_validate(r) for r in rows],
api\app\api\v1\endpoints\panel_admin.py:255:@router.post("/audit-logs", response_model=PanelAuditLogEntry, status_code=201)
api\app\api\v1\endpoints\health.py:68:        "messages_processed_total": None,
api\app\api\v1\endpoints\health.py:84:            messages_processed_total,
api\app\api\v1\endpoints\health.py:88:            "brain:metrics:messages_processed_total"
api\app\api\v1\endpoints\health.py:110:        brain_metrics["messages_processed_total"] = int(messages_processed_total) if messages_processed_total is not None else 0
api\app\api\v1\endpoints\dashboard.py:38:        "messages_processed_total": 0,
api\app\api\v1\endpoints\dashboard.py:49:        pipe.get("brain:metrics:messages_processed_total")
api\app\api\v1\endpoints\dashboard.py:50:        incoming, outgoing, resets, contention, processed = await pipe.execute()
api\app\api\v1\endpoints\dashboard.py:63:        brain_metrics["messages_processed_total"] = int(processed) if processed else 0
api\app\api\v1\endpoints\dashboard.py:224:            messages_processed=brain_metrics["messages_processed_total"],
api\app\api\v1\endpoints\dashboard.py:225:            reset_ratio=observability["ratios"]["system_reset_per_processed"],
api\app\api\v1\endpoints\dashboard.py:226:            contention_ratio=observability["ratios"]["lock_contention_per_processed"],
MB-Whatsapp\models\v15\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v15\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v15\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v15\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\models\v15\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v15\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\src\knowledge\knowledge.module.ts:8:import { EmbeddingService } from './embedding.service';
MB-Whatsapp\models\v15\feature_names.txt:14:logs_count
MB-Whatsapp\models\v15\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:4:import { EmbeddingService } from './embedding.service';
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:26:    private readonly embeddingService: EmbeddingService,
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:36:      const embedding = this.embeddingService.embed(content);
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:44:            embedding,
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:70:    const queryEmbedding = this.embeddingService.embed(query);
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:72:    // Alternative to pgvector: compute cosine in app layer over curated corpus.
MB-Whatsapp\src\knowledge\knowledge-index.service.ts:81:        const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, r.embedding ?? []);
MB-Whatsapp\docs\DIALOGUE_ENGINE_INTEGRATION.md:287:Dialogue-service produce logs JSON en formato:
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:16:        'logs': [log1, log2, log3],
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:40:logs_count = 3        # Hay logs disponibles
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:56:    3,       # logs_count
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:128:   - has_data=1, logs_count=3 → "información suficiente → actuar"
MB-Whatsapp\docs\CONTEXT_EXAMPLE.py:129:   - has_data=0, logs_count=0 → "no hay contexto → ser cauteloso"
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:10:- Contexto: logs, metrics, has_data, 7 categóricas
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:27:   - logs_count, metrics_count, has_data
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:186:✅ Dataset generado: `data/processed/X_train.csv` (18 cols)
MB-Whatsapp\docs\CONTEXT_ENRICHMENT.md:189:✅ Features name guardadas: `data/processed/feature_names.txt`
MB-Chat\src\integration\metabrain.handler.ts:115:        // execution details only when present (avoids null noise in logs)
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:18:├─ Context: logs_count, metrics_count, has_data
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:34:│  ├─ Datos: logs_count, metrics_count, has_data, *_normalized
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:47:data/processed/
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:56:✅ metadata.json            (meta)  - Info del dataset
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:201:# Genera: 37 features, dataset limpio, encoders
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:324:✅ 0 null values en dataset limpio
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:371:- [x] ✅ Generar dataset enriquecido
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:426:- Dataset: `data/processed/X_train.csv` (37 features)
MB-Whatsapp\docs\COMPLETION_CHECKLIST.md:427:- Features: `data/processed/feature_names.txt`
MB-Whatsapp\models\v14\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v14\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v14\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v14\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\src\integration\event.mapper.ts:13:  logs: string[];
MB-Chat\src\integration\event.mapper.ts:38:  logs?: unknown[];
MB-Chat\src\integration\event.mapper.ts:42:    logs?: unknown[];
MB-Chat\src\integration\event.mapper.ts:72:  if (event.metadata?.logs?.[0] && typeof event.metadata.logs[0] === 'string') {
MB-Chat\src\integration\event.mapper.ts:73:    return event.metadata.logs[0];
MB-Chat\src\integration\event.mapper.ts:79:  const rawLogs = event.metadata?.logs ?? event.logs ?? [];
MB-Chat\src\integration\event.mapper.ts:111:      logs: extractLogs(raw),
MB-Whatsapp\models\v14\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v14\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\models\v14\feature_names.txt:14:logs_count
MB-Whatsapp\models\v14\feature_names.txt:17:logs_count_normalized
MB-Chat\src\ingress\incident.controller.ts:23:  logs?: string[];
MB-Chat\src\ingress\incident.controller.ts:72:    const logs = Array.isArray(safe.logs) ? safe.logs.filter((entry) => typeof entry === 'string') : [];
MB-Chat\src\ingress\incident.controller.ts:73:    const message = safe.message ?? logs[0] ?? safe.type ?? 'incident';
MB-Chat\src\ingress\incident.controller.ts:82:        logs,
MB-Whatsapp\models\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\scripts\visualize_features.py:98:        'Behavioral Flags': ['escalation', 'retry_count', 'last_action', 'logs', 'metrics'],
MB-Whatsapp\scripts\validate_onnx_parity.py:10:    X_test = pd.read_csv('data/processed/X_test.csv')
MB-Whatsapp\models\v13\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v13\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v13\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v13\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\scripts\train_model_incremental.py:40:from model_registry import ModelRegistry
MB-Whatsapp\scripts\train_model_incremental.py:44:    """Load the historical training dataset"""
MB-Whatsapp\scripts\train_model_incremental.py:45:    X_train_path = Path('data/processed/X_train.csv')
MB-Whatsapp\scripts\train_model_incremental.py:46:    y_train_path = Path('data/processed/y_train.csv')
MB-Whatsapp\scripts\train_model_incremental.py:47:    X_test_path = Path('data/processed/X_test.csv')
MB-Whatsapp\scripts\train_model_incremental.py:48:    y_test_path = Path('data/processed/y_test.csv')
MB-Whatsapp\scripts\train_model_incremental.py:77:def combine_datasets(X_train, y_train, X_incremental, y_incremental):
MB-Whatsapp\scripts\train_model_incremental.py:78:    """Combine historical and incremental datasets"""
MB-Whatsapp\scripts\train_model_incremental.py:87:    print(f'[OnlineLearning] Combined dataset: {len(X_combined)} records, {len(X_combined.columns)} features')
MB-Whatsapp\scripts\train_model_incremental.py:148:        X_combined, y_combined, feature_names = combine_datasets(
MB-Whatsapp\scripts\train_model_incremental.py:188:        X_test_path='data/processed/X_test.csv',
MB-Whatsapp\scripts\train_model_incremental.py:218:    # Step 5: Export artifacts
MB-Whatsapp\models\v13\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v13\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\models\v13\feature_names.txt:14:logs_count
MB-Whatsapp\models\v13\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\scripts\train_model.py:25:from model_registry import ModelRegistry
MB-Whatsapp\scripts\train_model.py:280:def load_processed_metadata():
MB-Whatsapp\scripts\train_model.py:281:    metadata_path = 'data/processed/metadata.json'
MB-Whatsapp\scripts\train_model.py:291:def enforce_dataset_gate(y_train, y_val, y_test):
MB-Whatsapp\scripts\train_model.py:292:    metadata = load_processed_metadata()
MB-Whatsapp\scripts\train_model.py:293:    dataset_type = str(metadata.get('dataset_type', 'unknown')).lower()
MB-Whatsapp\scripts\train_model.py:295:    if dataset_type != 'production':
MB-Whatsapp\scripts\train_model.py:296:        print(f"Dataset type: {dataset_type} (production gate not enforced)")
MB-Whatsapp\scripts\train_model.py:313:            "Production dataset gate failed: "
MB-Whatsapp\scripts\train_model.py:357:    X_test_path: str = 'data/processed/X_test.csv',
MB-Whatsapp\scripts\train_model.py:470:    feature_names_path = 'data/processed/feature_names.txt'
MB-Whatsapp\scripts\train_model.py:472:    action_mapping_path = 'data/processed/action_mapping.txt'
MB-Whatsapp\scripts\train_model.py:476:    processed_metadata = load_processed_metadata()
MB-Whatsapp\scripts\train_model.py:522:        or processed_metadata.get('pipeline_version')
MB-Whatsapp\scripts\train_model.py:565:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\train_model.py:566:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\scripts\train_model.py:567:    X_val = pd.read_csv('data/processed/X_val.csv')
MB-Whatsapp\scripts\train_model.py:568:    y_val = pd.read_csv('data/processed/y_val.csv').values.ravel()
MB-Whatsapp\scripts\train_model.py:569:    X_test = pd.read_csv('data/processed/X_test.csv')
MB-Whatsapp\scripts\train_model.py:570:    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()
MB-Whatsapp\scripts\train_model.py:572:    enforce_dataset_gate(y_train, y_val, y_test)
MB-Whatsapp\scripts\train_model.py:652:        # Stratified K-Fold for imbalanced datasets
MB-Whatsapp\src\knowledge\embedding.service.ts:7:  // Lightweight local embedding alternative: hashed token embedding.
MB-Whatsapp\src\knowledge\embedding.service.ts:8:  // Avoids external embedding API dependency while enabling semantic-ish retrieval.
MB-Whatsapp\models\model_metrics.json:50:    "logs_count",
MB-Whatsapp\models\model_metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:78:      logs: ['double booking attempt', 'conflict resolution failed'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:92:      logs: ['booking conflict detected'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:107:      logs: ['timeout', 'connection reset'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:120:      logs: ['ECONNREFUSED 127.0.0.1:5432', 'timeout acquiring client'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:133:      logs: ['generic error log'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:146:      logs: ['partial error'],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:171:      logs: [],
MB-Whatsapp\src\brain\brain.mixed-traffic.spec.ts:237:            logs: ((event.payload as Record<string, unknown>)?.logs as string[]) || [],
MB-Whatsapp\scripts\traffic_shadow_real_check.py:11:PROCESSED_DIR = ROOT / "data" / "processed"
MB-Whatsapp\models\model_dl_metadata.json:18:    "logs_count",
MB-Whatsapp\models\model_dl_metadata.json:21:    "logs_count_normalized",
MB-Whatsapp\src\brain\brain.high-load.spec.ts:124:              logs: ['load-test'],
MB-Whatsapp\src\brain\brain.high-load.spec.ts:254:    const processedCount = records.filter((r) => !r.crashed).length;
MB-Whatsapp\src\brain\brain.high-load.spec.ts:262:      events_processed: processedCount,
MB-Whatsapp\src\brain\brain.high-load.spec.ts:281:    expect(summary.events_processed).toBe(INCIDENT_COUNT);
MB-Whatsapp\src\brain\brain.db-outage.simulation.spec.ts:53:    logs: [
MB-Whatsapp\src\brain\brain.db-outage.simulation.spec.ts:128:          message: payload.logs[0],
MB-Whatsapp\src\brain\brain.db-outage.simulation.spec.ts:131:            logs: payload.logs,
MB-Whatsapp\src\brain\brain.db-outage.simulation.spec.ts:155:  // ── Contract: all incidents processed ──────────────────────────────────────
MB-Whatsapp\src\persistence\schemas\online-training-buffer.schema.ts:34:   * Exact ONNX feature vector used in inference (float32 array)
MB-Whatsapp\src\integration\metabrain.handler.ts:115:        // execution details only when present (avoids null noise in logs)
MB-Whatsapp\services\nlg_service\app\main.py:21:    """Format logs as JSON for structured logging."""
MB-Whatsapp\src\audit\audit.service.ts:18:  private readonly logs: AuditEntity[] = [];
MB-Whatsapp\src\audit\audit.service.ts:25:      this.logs.push(...records);
MB-Whatsapp\src\audit\audit.service.ts:26:      this.logger.log(`[Audit] Loaded ${this.logs.length} audit records from database`);
MB-Whatsapp\src\audit\audit.service.ts:58:    return this.logs;
MB-Whatsapp\src\audit\audit.service.ts:63:    this.logs.push(sanitizedEntity);
MB-Whatsapp\src\audit\audit.service.ts:64:    if (this.logs.length > MAX_AUDIT_ENTRIES) {
MB-Whatsapp\src\audit\audit.service.ts:65:      this.logs.shift();
MB-Whatsapp\scripts\run_ml_validation.py:145:    # Step 1: Split production vs synthetic dataset
MB-Whatsapp\scripts\run_ml_validation.py:150:        [python_exe, "scripts/extract_real_dataset.py"]
MB-Whatsapp\scripts\run_ml_validation.py:164:            "data/production_dataset",
MB-Whatsapp\scripts\run_ml_validation.py:166:            "data/processed",
MB-Whatsapp\scripts\run_ml_validation.py:167:            "--dataset-type",
MB-Whatsapp\src\integration\event.mapper.ts:13:  logs: string[];
MB-Whatsapp\src\integration\event.mapper.ts:38:  logs?: unknown[];
MB-Whatsapp\src\integration\event.mapper.ts:42:    logs?: unknown[];
MB-Whatsapp\src\integration\event.mapper.ts:72:  if (event.metadata?.logs?.[0] && typeof event.metadata.logs[0] === 'string') {
MB-Whatsapp\src\integration\event.mapper.ts:73:    return event.metadata.logs[0];
MB-Whatsapp\src\integration\event.mapper.ts:79:  const rawLogs = event.metadata?.logs ?? event.logs ?? [];
MB-Whatsapp\src\integration\event.mapper.ts:111:      logs: extractLogs(raw),
MB-Whatsapp\models\v10\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v10\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v10\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v10\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\src\execution\execution.safety.spec.ts:51:      logs: ['Error: connect ECONNREFUSED 127.0.0.1:5432', 'timeout acquiring client from postgres'],
MB-Whatsapp\models\v10\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v10\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\models\v12\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v12\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v12\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v12\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\src\guard\rules\safety.rules.ts:113:    const logs = input.metadata?.logs;
MB-Chat\src\guard\rules\safety.rules.ts:114:    if (Array.isArray(logs)) {
MB-Chat\src\guard\rules\safety.rules.ts:116:        this.normalize(logs.filter((l) => typeof l === 'string').join(' ')),
MB-Whatsapp\models\v10\feature_names.txt:14:logs_count
MB-Whatsapp\models\v10\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\models\v12\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v12\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\models\v12\feature_names.txt:14:logs_count
MB-Whatsapp\models\v12\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\scripts\generate_synthetic_data.py:97:def generate_synthetic_dataset(total_incidents: int, seed: int, noise_level: float) -> Dict[str, List[dict]]:
MB-Whatsapp\scripts\generate_synthetic_data.py:155:            logs_count = max(0, int(random.gauss(5 if severity in ("low", "medium") else 9, 2)))
MB-Whatsapp\scripts\generate_synthetic_data.py:172:                        "logs": [f"{severity.upper()} signal {i}" for i in range(logs_count)],
MB-Whatsapp\scripts\generate_synthetic_data.py:260:    dataset = generate_synthetic_dataset(total_incidents=args.count, seed=args.seed, noise_level=args.noise)
MB-Whatsapp\scripts\generate_synthetic_data.py:263:    write_json(data_dir / "incidents.json", dataset["incidents"])
MB-Whatsapp\scripts\generate_synthetic_data.py:264:    write_json(data_dir / "outcomes.json", dataset["outcomes"])
MB-Whatsapp\scripts\generate_synthetic_data.py:265:    write_json(data_dir / "audit.json", dataset["audits"])
MB-Whatsapp\scripts\generate_synthetic_data.py:267:    print("Synthetic dataset generated successfully")
MB-Whatsapp\scripts\generate_synthetic_data.py:268:    print(f"  Incidents: {len(dataset['incidents'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:269:    print(f"  Outcomes:  {len(dataset['outcomes'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:270:    print(f"  Audits:    {len(dataset['audits'])}")
MB-Whatsapp\scripts\generate_synthetic_data.py:271:    print(f"  Distribution by action: {dataset['class_distribution']}")
MB-Chat\src\guard\guard.service.spec.ts:36:      action: 'clear_cache',
MB-Whatsapp\scripts\feature_selection.py:74:        elif 'logs_count' in feat:
MB-Whatsapp\scripts\feature_selection.py:261:    print("\nLoading datasets...")
MB-Whatsapp\scripts\feature_selection.py:262:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\feature_selection.py:263:    X_test = pd.read_csv('data/processed/X_test.csv')
MB-Whatsapp\scripts\feature_selection.py:264:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\scripts\feature_selection.py:265:    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()
MB-Whatsapp\scripts\feature_selection.py:267:    with open('data/processed/feature_names.txt') as f:
MB-Whatsapp\scripts\feature_selection.py:337:    print(f"\nRecommendations for dataset optimization:")
MB-Whatsapp\scripts\feature_selection.py:348:    os.makedirs('data/processed', exist_ok=True)
MB-Whatsapp\scripts\feature_selection.py:355:    X_train_opt.to_csv('data/processed/X_train_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:356:    X_test_opt.to_csv('data/processed/X_test_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:357:    y_train.to_csv('data/processed/y_train_optimized.csv', index=False) if hasattr(y_train, 'to_csv') else pd.Series(y_train).to_csv('data/processed/y_train_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:358:    y_test.to_csv('data/processed/y_test_optimized.csv', index=False) if hasattr(y_test, 'to_csv') else pd.Series(y_test).to_csv('data/processed/y_test_optimized.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:360:    with open('data/processed/feature_names_optimized.txt', 'w') as f:
MB-Whatsapp\scripts\feature_selection.py:375:    X_train_top80.to_csv('data/processed/X_train_top80_importance.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:376:    X_test_top80.to_csv('data/processed/X_test_top80_importance.csv', index=False)
MB-Whatsapp\scripts\feature_selection.py:378:    with open('data/processed/feature_names_top80_importance.txt', 'w') as f:
MB-Whatsapp\src\execution\command.registry.ts:29:  clear_cache: {
MB-Whatsapp\scripts\extract_real_dataset.py:107:        description='Split data into production and synthetic datasets using incident provenance heuristics.'
MB-Whatsapp\scripts\extract_real_dataset.py:110:    parser.add_argument('--production-dir', default='data/production_dataset', help='Output directory for production dataset')
MB-Whatsapp\scripts\extract_real_dataset.py:111:    parser.add_argument('--synthetic-dir', default='data/synthetic_dataset', help='Output directory for synthetic dataset')
MB-Whatsapp\scripts\extract_real_dataset.py:135:    with (source_dir / 'dataset_split_summary.json').open('w', encoding='utf-8') as f:
MB-Whatsapp\scripts\extract_real_dataset.py:141:    print(f"  Summary: {(source_dir / 'dataset_split_summary.json').resolve()}")
MB-Whatsapp\src\ingress\incident.controller.ts:23:  logs?: string[];
MB-Whatsapp\src\ingress\incident.controller.ts:72:    const logs = Array.isArray(safe.logs) ? safe.logs.filter((entry) => typeof entry === 'string') : [];
MB-Whatsapp\src\ingress\incident.controller.ts:73:    const message = safe.message ?? logs[0] ?? safe.type ?? 'incident';
MB-Whatsapp\src\ingress\incident.controller.ts:82:        logs,
MB-Whatsapp\scripts\demo_model_registry.py:14:from model_registry import ModelRegistry
MB-Whatsapp\scripts\data_pipeline.py:262:            logs_count = len(metadata.get('logs', []))
MB-Whatsapp\scripts\data_pipeline.py:316:                'logs_count': logs_count,
MB-Whatsapp\scripts\data_pipeline.py:319:                'logs_count_normalized': min(logs_count / 50.0, 1.0),
MB-Whatsapp\scripts\data_pipeline.py:442:def create_dataset(input_dir='data/production_dataset', output_dir='data/processed', dataset_type='production'):
MB-Whatsapp\scripts\data_pipeline.py:443:    """Create enriched ML dataset with advanced features"""
MB-Whatsapp\scripts\data_pipeline.py:458:            "Run scripts/extract_real_dataset.py first or provide a valid --input-dir."
MB-Whatsapp\scripts\data_pipeline.py:560:        print(f"✓ Balanced dataset size: {len(df_clean)}")
MB-Whatsapp\scripts\data_pipeline.py:602:        'logs_count', 'metrics_count', 'has_data',
MB-Whatsapp\scripts\data_pipeline.py:603:        'logs_count_normalized', 'metrics_count_normalized',
MB-Whatsapp\scripts\data_pipeline.py:640:        # For small datasets, use 70/30 split and duplicate validation from test
MB-Whatsapp\scripts\data_pipeline.py:645:        # Duplicate test as validation for small datasets
MB-Whatsapp\scripts\data_pipeline.py:648:        print(f"\nSmall dataset ({n_samples} samples) - using 70/30 split with validation = test")
MB-Whatsapp\scripts\data_pipeline.py:684:    # Save raw datasets
MB-Whatsapp\scripts\data_pipeline.py:692:    # Save scaled datasets (for RF, need original; for NN/SVM need scaled)
MB-Whatsapp\scripts\data_pipeline.py:711:        'dataset_type': dataset_type,
MB-Whatsapp\scripts\data_pipeline.py:746:   ├─ Context: 5 (logs, metrics, severity)
MB-Whatsapp\scripts\data_pipeline.py:762:    parser = argparse.ArgumentParser(description='Feature engineering pipeline for MetaBrain datasets')
MB-Whatsapp\scripts\data_pipeline.py:763:    parser.add_argument('--input-dir', default='data/production_dataset', help='Input dataset directory')
MB-Whatsapp\scripts\data_pipeline.py:764:    parser.add_argument('--output-dir', default='data/processed', help='Output processed directory')
MB-Whatsapp\scripts\data_pipeline.py:766:        '--dataset-type',
MB-Whatsapp\scripts\data_pipeline.py:773:    create_dataset(input_dir=args.input_dir, output_dir=args.output_dir, dataset_type=args.dataset_type)
MB-Whatsapp\scripts\build_sequence_dataset.py:29:    'logs_count',
MB-Whatsapp\scripts\build_sequence_dataset.py:140:    logs = metadata.get('logs', []) if isinstance(metadata.get('logs', []), list) else []
MB-Whatsapp\scripts\build_sequence_dataset.py:161:        'logs_count': float(len(logs)),
MB-Whatsapp\scripts\build_sequence_dataset.py:193:        'logs_count': 0.0,
MB-Whatsapp\scripts\build_sequence_dataset.py:222:        'logs_count': 0.0,
MB-Whatsapp\scripts\build_sequence_dataset.py:322:        'logs_count': float(event.get('logs_count', 0.0)),
MB-Whatsapp\scripts\build_sequence_dataset.py:408:    parser = argparse.ArgumentParser(description='Build sequential anomaly dataset from system events')
MB-Whatsapp\scripts\build_sequence_dataset.py:410:    parser.add_argument('--output-dir', default='data/processed', help='Directory to write X_sequences.npy and metadata')
MB-Whatsapp\src\ai\providers\groq.provider.ts:48:  // LRU-style bounded response cache (keyed by prompt SHA-256)
MB-Whatsapp\src\ai\providers\groq.provider.ts:49:  private readonly cache = new Map<string, CacheEntry>();
MB-Whatsapp\src\ai\providers\groq.provider.ts:81:  private cacheKey(prompt: string): string {
MB-Whatsapp\src\ai\providers\groq.provider.ts:85:  private cacheGet(key: string): AiAnalysisResult | undefined {
MB-Whatsapp\src\ai\providers\groq.provider.ts:86:    const entry = this.cache.get(key);
MB-Whatsapp\src\ai\providers\groq.provider.ts:89:      this.cache.delete(key);
MB-Whatsapp\src\ai\providers\groq.provider.ts:95:  private cacheSet(key: string, value: AiAnalysisResult): void {
MB-Whatsapp\src\ai\providers\groq.provider.ts:96:    if (this.cache.size >= CACHE_MAX_SIZE) {
MB-Whatsapp\src\ai\providers\groq.provider.ts:98:      const firstKey = this.cache.keys().next().value;
MB-Whatsapp\src\ai\providers\groq.provider.ts:99:      if (firstKey !== undefined) this.cache.delete(firstKey);
MB-Whatsapp\src\ai\providers\groq.provider.ts:101:    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
MB-Whatsapp\src\ai\providers\groq.provider.ts:206:  // ── Public: runAnalysis (with cache + circuit breaker + quality validation) ──
MB-Whatsapp\src\ai\providers\groq.provider.ts:214:    const key = this.cacheKey(prompt);
MB-Whatsapp\src\ai\providers\groq.provider.ts:215:    const cached = this.cacheGet(key);
MB-Whatsapp\src\ai\providers\groq.provider.ts:216:    if (cached) {
MB-Whatsapp\src\ai\providers\groq.provider.ts:217:      this.logger.debug('[AI:cache] HIT — returning cached analysis');
MB-Whatsapp\src\ai\providers\groq.provider.ts:218:      return cached;
MB-Whatsapp\src\ai\providers\groq.provider.ts:254:          this.cacheSet(key, result);
MB-Chat\src\execution\execution.safety.spec.ts:51:      logs: ['Error: connect ECONNREFUSED 127.0.0.1:5432', 'timeout acquiring client from postgres'],
MB-Whatsapp\scripts\analyze_features.py:4:Analyzes the enriched dataset and shows which features are most valuable
MB-Whatsapp\scripts\analyze_features.py:18:    with open('data/processed/feature_names.txt') as f:
MB-Whatsapp\scripts\analyze_features.py:27:    # Check if datasets exist
MB-Whatsapp\scripts\analyze_features.py:28:    if not os.path.exists('data/processed/X_train.csv'):
MB-Whatsapp\scripts\analyze_features.py:34:    print("\nLoading datasets...")
MB-Whatsapp\scripts\analyze_features.py:35:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\scripts\analyze_features.py:36:    y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\scripts\analyze_features.py:104:                      ['logs_count', 'metrics_count', 'has_data', 'severity'])]
MB-Whatsapp\models\v11\onnx_metadata.json:23:    "logs_count",
MB-Whatsapp\models\v11\onnx_metadata.json:26:    "logs_count_normalized",
MB-Whatsapp\models\v11\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Whatsapp\models\v11\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\models\v11\metrics.json:50:    "logs_count",
MB-Whatsapp\models\v11\metrics.json:53:    "logs_count_normalized",
MB-Chat\src\execution\command.registry.ts:29:  clear_cache: {
MB-Whatsapp\data\synthetic_dataset\incidents.json:16:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:60:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:109:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:154:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:196:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:236:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:287:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:332:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:383:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:424:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:468:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:515:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:561:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:605:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:646:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:688:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:734:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:781:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:826:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:871:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:916:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:962:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1008:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1048:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1090:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1132:        "logs": [],
MB-Whatsapp\data\synthetic_dataset\incidents.json:1170:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1213:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1253:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1299:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1342:        "logs": [],
MB-Whatsapp\data\synthetic_dataset\incidents.json:1380:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1425:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1469:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1512:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1558:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1602:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1649:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1690:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1732:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1773:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1819:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1863:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1904:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1951:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:1998:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2041:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2083:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2130:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2177:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2221:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2267:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2313:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2358:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2408:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2450:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2492:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2542:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2589:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2636:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2682:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2727:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2774:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2822:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2866:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2908:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:2957:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3001:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3050:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3099:        "logs": [],
MB-Whatsapp\data\synthetic_dataset\incidents.json:3137:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3187:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3237:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3284:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3332:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3379:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3424:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3469:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3517:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3560:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3600:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3650:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3699:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3743:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3787:        "logs": [],
MB-Whatsapp\data\synthetic_dataset\incidents.json:3825:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3874:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3917:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:3964:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4008:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4058:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4104:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4149:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4196:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4246:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4289:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4337:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4383:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4428:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4477:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4518:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4565:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4611:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4658:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4703:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4748:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4794:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4838:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4883:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4924:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:4973:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5021:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5069:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5117:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5168:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5215:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5259:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5306:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5357:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5403:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5451:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5495:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5541:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5588:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5636:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5684:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5732:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5776:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5819:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5868:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5911:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:5959:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6005:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6050:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6098:        "logs": [],
MB-Whatsapp\data\synthetic_dataset\incidents.json:6136:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6180:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6223:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6271:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6318:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6365:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6408:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6460:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6510:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6558:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6607:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6651:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6696:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6742:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6783:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6828:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6870:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6917:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:6968:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7016:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7063:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7110:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7160:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7208:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7256:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7301:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7341:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7391:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7435:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7483:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7530:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7576:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7621:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7666:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7710:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7755:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7804:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7846:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7890:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7932:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:7977:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8023:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8069:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8119:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8162:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8204:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8250:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8297:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8340:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8386:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8433:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8479:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8525:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8573:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8619:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8670:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8711:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8754:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8801:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8848:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8895:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8942:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:8987:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9029:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9075:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9122:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9167:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9213:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9255:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9304:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9346:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9389:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9435:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9486:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9534:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9582:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9624:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9671:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9719:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9770:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9818:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9869:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9910:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:9960:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10003:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10051:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10098:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10147:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10200:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10245:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10292:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10337:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10384:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10428:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10473:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10521:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10567:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10613:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10656:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10700:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10748:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10798:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10845:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10892:        "logs": [
MB-Whatsapp\data\synthetic_dataset\incidents.json:10940:        "logs": [
MB-Whatsapp\models\v11\feature_names.txt:14:logs_count
MB-Whatsapp\models\v11\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\src\ai\medical-imaging.service.ts:30:    const preprocessed = this.preprocessImage(input.imageBase64, input.mimeType);
MB-Whatsapp\src\ai\medical-imaging.service.ts:51:          image_base64: preprocessed.payloadBase64,
MB-Whatsapp\src\ai\medical-imaging.service.ts:52:          mime_type: preprocessed.mimeType,
MB-Whatsapp\src\ai\ai-provider.failure.spec.ts:219:            logs: ['timeout', 'connection failed'],
MB-Whatsapp\src\guard\rules\safety.rules.ts:113:    const logs = input.metadata?.logs;
MB-Whatsapp\src\guard\rules\safety.rules.ts:114:    if (Array.isArray(logs)) {
MB-Whatsapp\src\guard\rules\safety.rules.ts:116:        this.normalize(logs.filter((l) => typeof l === 'string').join(' ')),
MB-Whatsapp\services\dialogue_engine\QUICKSTART.md:203:**Ver logs en tiempo real:**
MB-Whatsapp\services\dialogue_engine\QUICKSTART.md:212:docker logs dialogue-service -f
MB-Whatsapp\services\api_gateway\main.py:270:    security.clear_security_settings_cache()
MB-Whatsapp\src\guard\guard.service.spec.ts:36:      action: 'clear_cache',
MB-Whatsapp\services\decision_service\app\dependencies.py:5:from functools import lru_cache
MB-Whatsapp\services\decision_service\app\dependencies.py:37:@lru_cache(maxsize=1)
MB-Chat\src\events\consumer\incident.consumer.ts:11:  private readonly processed = new Map<string, number>();
MB-Chat\src\events\consumer\incident.consumer.ts:123:    const value = this.processed.get(eventId);
MB-Chat\src\events\consumer\incident.consumer.ts:128:    this.processed.set(eventId, Date.now() + this.idempotencyTtlMs);
MB-Chat\src\events\consumer\incident.consumer.ts:133:    for (const [eventId, expiresAt] of this.processed.entries()) {
MB-Chat\src\events\consumer\incident.consumer.ts:134:      if (expiresAt <= now) this.processed.delete(eventId);
MB-Secretaria\src\guard\rules\safety.rules.ts:113:    const logs = input.metadata?.logs;
MB-Secretaria\src\guard\rules\safety.rules.ts:114:    if (Array.isArray(logs)) {
MB-Secretaria\src\guard\rules\safety.rules.ts:116:        this.normalize(logs.filter((l) => typeof l === 'string').join(' ')),
MB-Whatsapp\src\action-engine\action.service.spec.ts:24:      action: 'clear_cache',
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:55:- logs_count (2.21% neighborhood)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:113:X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:114:X_test = pd.read_csv('data/processed/X_test_optimized.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:115:y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:116:y_test = pd.read_csv('data/processed/y_test_optimized.csv').values.ravel()
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:128:X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:129:X_test = pd.read_csv('data/processed/X_test_top80_importance.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:149:X_train_full = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:246:- Count metadata (logs_count, metrics_count)
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:269:    features_file = "data/processed/feature_names_optimized.txt"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:270:    data_train = "data/processed/X_train_optimized.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:271:    data_test = "data/processed/X_test_optimized.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:273:    features_file = "data/processed/feature_names_top80_importance.txt"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:274:    data_train = "data/processed/X_train_top80_importance.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:275:    data_test = "data/processed/X_test_top80_importance.csv"
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:282:y_train = pd.read_csv("data/processed/y_train_optimized.csv").values.ravel()
MB-Whatsapp\docs\QUICKSTART_FEATURE_SELECTION.md:283:y_test = pd.read_csv("data/processed/y_test_optimized.csv").values.ravel()
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:5:El dataset de entrenamiento pasó de **10 features simples** a **37 features avanzadas**:
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:84:logs_count, metrics_count, has_data
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:85:logs_count_normalized, metrics_count_normalized
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:114:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:115:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:118:with open('data/processed/feature_names.txt') as f:
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:173:   ls data/processed/X_*.csv
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:179:   wc -l data/processed/feature_names.txt
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:185:   python -c "import pandas as pd; df = pd.read_csv('data/processed/X_train.csv'); print(f'Nulls: {df.isnull().sum().sum()}')"
MB-Whatsapp\docs\QUICKSTART_ENRICHED_FEATURES.md:240:1. ✓ Generar dataset: `python scripts/data_pipeline.py`
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:14:- **Output datasets ready:** ✅ Yes (3 variants prepared)
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:75:    'full': 'data/processed/X_train_optimized.csv',
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:76:    'top80': 'data/processed/X_train_top80_importance.csv',
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:114:    # Load datasets
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:116:        X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:117:        X_test = pd.read_csv('data/processed/X_test_optimized.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:119:        X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:120:        X_test = pd.read_csv('data/processed/X_test_top80_importance.csv')
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:124:    y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:125:    y_test = pd.read_csv('data/processed/y_test_optimized.csv').values.ravel()
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:380:- Check for vector operations bottlenecks
MB-Whatsapp\docs\PHASE_3_ACTION_PLAN.md:418:python -c "import pandas as pd; print(pd.read_csv('data/processed/X_train_optimized.csv').shape)"
MB-Whatsapp\src\learning\learning.service.ts:136:        `${pythonCmd} scripts/extract_real_dataset.py`,
MB-Whatsapp\src\learning\learning.service.ts:137:        `${pythonCmd} scripts/data_pipeline.py --input-dir data/production_dataset --output-dir data/processed --dataset-type production`,
MB-Chat\src\events\bridge\normalizers\event.normalizer.ts:10:  logs: string[];
MB-Chat\src\events\bridge\normalizers\event.normalizer.ts:24:      logs: this.normalizeLogs(input),
MB-Chat\src\events\bridge\normalizers\event.normalizer.ts:81:    const candidate = input.logs ?? input.logLines ?? input.messages;
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:23:- Produced ready-to-use optimized datasets
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:74:- **Data availability**: logs_count, metrics_count
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:94:Sample Count:           1 train, 1 test (demo dataset)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:387:- [x] Production datasets prepared
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:468:- Encoder/scaler artifacts: ~5MB total
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:530:3. **Production-ready datasets** with zero quality issues
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:551:- `data/processed/X_train_optimized.csv` (37 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:552:- `data/processed/X_test_optimized.csv` (37 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:553:- `data/processed/X_train_top80_importance.csv` (31 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:554:- `data/processed/X_test_top80_importance.csv` (31 features)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:555:- `data/processed/feature_names_*.txt` (Feature metadata)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:556:- `data/processed/y_train*.csv` / `y_test*.csv` (Labels)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:559:- `data/processed/feature_encoders.pkl` (LabelEncoders)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:560:- `data/processed/action_encoder.pkl` (Action space)
MB-Whatsapp\docs\PHASES_1_2_COMPLETION_SUMMARY.md:561:- `data/processed/feature_scaler.pkl` (Normalization)
MB-Whatsapp\src\dl\sequence-builder.ts:22:  logsCount: number;
MB-Whatsapp\src\dl\sequence-builder.ts:97:    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];
MB-Whatsapp\src\dl\sequence-builder.ts:115:      logsCount: logs.length,
MB-Whatsapp\src\dl\sequence-builder.ts:142:      logsCount: 0,
MB-Whatsapp\src\dl\sequence-builder.ts:174:      logsCount: 0,
MB-Whatsapp\src\dl\sequence-builder.ts:213:      logs_count: event.logsCount,
MB-Chat\src\events\bridge\event.bridge.service.ts:54:        logs: event.logs.map((entry) => this.sanitizeString(entry)),
MB-Chat\src\events\bridge\event.bridge.service.ts:68:    if (event.logs.length > 0) {
MB-Chat\src\events\bridge\event.bridge.service.ts:69:      return this.sanitizeString(event.logs[0]);
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:99:│     │     └─ DEPLOYMENT BLOCKED (pero artifacts guardados)   │
MB-Whatsapp\docs\ONLINE_LEARNING_ARCHITECTURE.md:248:  3. combine_datasets()
MB-Whatsapp\src\events\bridge\normalizers\event.normalizer.ts:10:  logs: string[];
MB-Whatsapp\src\events\bridge\normalizers\event.normalizer.ts:24:      logs: this.normalizeLogs(input),
MB-Whatsapp\src\events\bridge\normalizers\event.normalizer.ts:81:    const candidate = input.logs ?? input.logLines ?? input.messages;
MB-Whatsapp\src\ml-service\metrics.service.ts:33:  private readonly cacheHits = new Counter({
MB-Whatsapp\src\ml-service\metrics.service.ts:34:    name: 'ml_service_cache_hits_total',
MB-Whatsapp\src\ml-service\metrics.service.ts:35:    help: 'Total number of cache hits',
MB-Whatsapp\src\ml-service\metrics.service.ts:38:  private readonly cacheMisses = new Counter({
MB-Whatsapp\src\ml-service\metrics.service.ts:39:    name: 'ml_service_cache_misses_total',
MB-Whatsapp\src\ml-service\metrics.service.ts:40:    help: 'Total number of cache misses',
MB-Whatsapp\src\ml-service\metrics.service.ts:90:    this.cacheHits.inc();
MB-Whatsapp\src\ml-service\metrics.service.ts:94:    this.cacheMisses.inc();
MB-Whatsapp\src\ml-service\metrics.service.ts:130:      cache: {
MB-Whatsapp\src\events\consumer\incident.consumer.ts:11:  private readonly processed = new Map<string, number>();
MB-Whatsapp\src\events\consumer\incident.consumer.ts:123:    const value = this.processed.get(eventId);
MB-Whatsapp\src\events\consumer\incident.consumer.ts:128:    this.processed.set(eventId, Date.now() + this.idempotencyTtlMs);
MB-Whatsapp\src\events\consumer\incident.consumer.ts:133:    for (const [eventId, expiresAt] of this.processed.entries()) {
MB-Whatsapp\src\events\consumer\incident.consumer.ts:134:      if (expiresAt <= now) this.processed.delete(eventId);
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:9:### 1. ✅ Model Registry (`scripts/model_registry.py`)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:227:from model_registry import ModelRegistry
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:256:python scripts/demo_model_registry.py
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:273:| `num_train_samples` | Tamaño dataset entrenamiento |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:274:| `num_test_samples` | Tamaño dataset test |
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:323:├── model_registry.py       (420 líneas)
MB-Whatsapp\docs\MODEL_EVOLUTION_SUMMARY.md:326:├── demo_model_registry.py  (250 líneas)
MB-Whatsapp\src\events\bridge\event.bridge.service.ts:54:        logs: event.logs.map((entry) => this.sanitizeString(entry)),
MB-Whatsapp\src\events\bridge\event.bridge.service.ts:68:    if (event.logs.length > 0) {
MB-Whatsapp\src\events\bridge\event.bridge.service.ts:69:      return this.sanitizeString(event.logs[0]);
MB-Whatsapp\data\processed\X_val.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\data\processed\X_train_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:41:- k = min(5, len(train_data)) - Adapta a datasets pequeños
MB-Whatsapp\docs\ML_VALIDATION_SUMMARY.md:197:- Precision/recall/F1 metrics por dataset
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:34:- **Context (6)**: logs_count, metrics_count, has_data, severity (inferred), + normalized versions
MB-Whatsapp\docs\ML_VALIDATION_PRODUCTION.md:448:data/processed/
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:368:with open('data/processed/feature_names.txt') as f:
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:403:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\ML_VALIDATION_INTEGRATION.md:404:y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Whatsapp\data\processed\X_train_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\data\processed\X_train.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\data\processed\X_test_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:43:### 1. Model Registry (`scripts/model_registry.py`)
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:290:python scripts/model_registry.py
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:298:from model_registry import ModelRegistry
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:408:3. **Registers with model_registry.py**
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:491:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:499:python -c "from model_registry import ModelRegistry; \
MB-Whatsapp\docs\ML_MODEL_REGISTRY.md:599:- Clear any Python import caches
MB-Whatsapp\src\ml\online-learning.service.ts:18: * - FASE 4: Incremental dataset generation + retraining
MB-Whatsapp\src\ml\online-learning.service.ts:128:      // Step 2: Export incremental dataset from buffer
MB-Whatsapp\src\ml\online-learning.service.ts:131:        `[OnlineLearning] Exported incremental dataset: ${incrementalDataPath}`,
MB-Whatsapp\data\processed\X_test_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:55:- **Change**: Accepts enriched feature vector, not just hour/day
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:155:3. Monitor logs for `[COMBINED_SCORE]` patterns
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:173:- Minimal (insights cached per decision)
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:206:| Debuggable decisions | ✅ | Full breakdown in logs |
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:244:- **Monitoring**: Check logs for `[COMBINED_SCORE]` patterns
MB-Whatsapp\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:245:- **Debugging**: Review decision scoring breakdown in logs
MB-Whatsapp\src\ml\model.service.ts:45:   * @param features Enriched feature vector with learning-based signals
MB-Whatsapp\data\processed\X_test.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Whatsapp\docs\ML_FEATURES.md:34:| `logs_count` | int | Cantidad de logs disponibles |
MB-Whatsapp\docs\ML_FEATURES.md:88:[Context Calculation] → severity, logs_count, metrics_count
MB-Whatsapp\docs\ML_FEATURES.md:168:Con dataset muy pequeño (1-2 muestras por clase):
MB-Whatsapp\data\processed\sequence_metadata.json:20:    "logs_count",
MB-Chat\MB_CHAT_LOADTEST_SMOKE_RESULT.md:92:- Token value was not printed in logs or report.
MB-Chat\MB_CHAT_LOADTEST_PRECHECK.md:37:- Local storage/logs: memory history file (`CEREBRO_MEMORY_HISTORY_PATH`) and structured logging.
MB-Chat\MB_CHAT_LOADTEST_IMPLEMENTATION_REPORT.md:77:- No PHI/PII dataset was introduced.
MB-Chat\src\dl\sequence-builder.ts:22:  logsCount: number;
MB-Chat\src\dl\sequence-builder.ts:97:    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];
MB-Chat\src\dl\sequence-builder.ts:115:      logsCount: logs.length,
MB-Chat\src\dl\sequence-builder.ts:142:      logsCount: 0,
MB-Chat\src\dl\sequence-builder.ts:174:      logsCount: 0,
MB-Chat\src\dl\sequence-builder.ts:213:      logs_count: event.logsCount,
MB-Whatsapp\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Whatsapp\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
MB-Whatsapp\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Whatsapp\data\processed\feature_names_top80_importance.txt:21:logs_count
MB-Whatsapp\data\processed\feature_names_top80_importance.txt:23:logs_count_normalized
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:204:grep -i "ESCALATE" logs/*.log
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:211:grep -i "ML_ACCURACY_RECORD" logs/*.log | wc -l
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:212:# Compare with [COMBINED_SCORE] logs to see ratio
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:273:2. **Root Cause**: Check logs
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:296:- [ ] ML accuracy tracking logs appear
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:321:1. Check `[COMBINED_SCORE]` logs for breakdown
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:322:2. Verify ML model exists and loads (model_service logs)
MB-Whatsapp\docs\MIGRATION_ML_PRIMARY_SOURCE.md:325:5. Compare rules vs ML accuracy in logs
MB-Whatsapp\data\processed\feature_names_optimized.txt:14:logs_count
MB-Whatsapp\data\processed\feature_names_optimized.txt:17:logs_count_normalized
MB-Whatsapp\data\processed\feature_names.txt:14:logs_count
MB-Whatsapp\data\processed\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\docs\FILE_MANIFEST.md:14:3. **[QUICKSTART_FEATURE_SELECTION.md](QUICKSTART_FEATURE_SELECTION.md)** - How to use datasets
MB-Whatsapp\docs\FILE_MANIFEST.md:75:data/processed/
MB-Whatsapp\docs\FILE_MANIFEST.md:94:data/processed/
MB-Whatsapp\docs\FILE_MANIFEST.md:113:└── processed/
MB-Whatsapp\docs\FILE_MANIFEST.md:317:| 28 | logs_count | Context | 2.21% |
MB-Whatsapp\docs\FILE_MANIFEST.md:327:| 34 | logs_count_normalized | Behavior | 2.21% |
MB-Whatsapp\docs\FILE_MANIFEST.md:337:2. Load data from data/processed/X_train_optimized.csv
MB-Whatsapp\docs\FILE_MANIFEST.md:383:  Training datasets:             ✅ Ready
MB-Whatsapp\docs\FILE_MANIFEST.md:384:  Test datasets:                 ✅ Ready
MB-Whatsapp\docs\FILE_MANIFEST.md:406:│   └── processed/
MB-Whatsapp\docs\FILE_MANIFEST.md:454:(Expandable to GBs with full incident dataset)
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:11:The feature selection pipeline analyzed the 37-feature dataset to identify which features drive model predictions and eliminate redundancy. With theoretical importance scoring (demo data has single action class), we identified:
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:104:- **80/20 Rule**: Just 31 features (84% of dataset) capture 80% of predictive power
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:163:| logs_count | 2.21% | Data availability |
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:196:Keeping all features maintains information diversity. Feature pruning would only reduce interpretability without computational benefit (with current small dataset size).
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:294:✅ **data/processed/X_train_optimized.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:295:✅ **data/processed/X_test_optimized.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:296:✅ **data/processed/feature_names_optimized.txt**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:300:✅ **data/processed/X_train_top80_importance.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:301:✅ **data/processed/X_test_top80_importance.csv**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:302:✅ **data/processed/feature_names_top80_importance.txt**
MB-Whatsapp\docs\FEATURE_SELECTION_ANALYSIS.md:328:Since the demo dataset contains only a single action class, we applied **theoretical feature importance** based on:
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:11:Expandir significativamente el dataset de ML eliminando dependencia de variables temporales simples y capturando **contexto real** y **comportamiento histórico** para mejorar generalización y reducir overfitting.
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:45:logs_count, metrics_count, has_data
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:46:logs_count_normalized, metrics_count_normalized
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:94:- Ejemplos de feature vectors
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:115:- Resultado: 0 valores nulos en dataset final
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:161:  37-feature CSV dataset
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:186:  - Contexto disponible (logs, métricas)
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:207:data/processed/
MB-Whatsapp\docs\FEATURE_EXPANSION_SUMMARY.md:236:1. ✅ Generar dataset enriquecido
MB-Chat\src\diagnosis\diagnosis.service.ts:47:            : 'Desglose tecnico-legal completo: capas SRE-Med, logs internos y fundamento de exclusiones terapeuticas.',
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:12:Expand ML dataset from **10 basic features** → **37 advanced features**
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:81:  • logs_count, metrics_count (raw counts)
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:110:data/processed/
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:181:├── Example vectors
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:407:✅ 0 null values in cleaned dataset
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:411:✅ dataset ready for training
MB-Whatsapp\docs\FEATURE_EXPANSION_DASHBOARD.md:444:✅ data/processed/* (dataset)
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:5:Se ha expandido significativamente el dataset de entrenamiento pasando de **10 features simples** a **37 features avanzadas**, eliminando la dependencia de variables temporales básicas y capturando contexto real, comportamiento histórico y señales de comportamiento.
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:68:| `logs_count` | Número de logs disponibles | 0-∞ | Data richness |
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:71:| `logs_count_normalized` | logs_count normalizado | 0-1 | ML-ready |
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:75:**Beneficio:** El contexto rico (logs/métricas) determina confiabilidad de features y decisiones.
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:119:  "logs_count": 0,
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:146:  "logs_count": 0,
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:149:  "logs_count_normalized": 0,
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:219:data/processed/
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:275:# 5. Guarda datasets en data/processed/
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:286:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:287:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:294:X_train_scaled = pd.read_csv('data/processed/X_train_scaled.csv')
MB-Whatsapp\docs\FEATURE_ENGINEERING_ENRICHED.md:311:with open('data/processed/feature_names.txt') as f:
MB-Whatsapp\data\model-registry.json:11:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache"],
MB-Whatsapp\data\model-registry.json:24:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache", "scale_up"],
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:55:- logs_count (2.21% neighborhood)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:113:X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:114:X_test = pd.read_csv('data/processed/X_test_optimized.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:115:y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:116:y_test = pd.read_csv('data/processed/y_test_optimized.csv').values.ravel()
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:128:X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:129:X_test = pd.read_csv('data/processed/X_test_top80_importance.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:149:X_train_full = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:246:- Count metadata (logs_count, metrics_count)
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:269:    features_file = "data/processed/feature_names_optimized.txt"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:270:    data_train = "data/processed/X_train_optimized.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:271:    data_test = "data/processed/X_test_optimized.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:273:    features_file = "data/processed/feature_names_top80_importance.txt"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:274:    data_train = "data/processed/X_train_top80_importance.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:275:    data_test = "data/processed/X_test_top80_importance.csv"
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:282:y_train = pd.read_csv("data/processed/y_train_optimized.csv").values.ravel()
MB-Chat\docs\QUICKSTART_FEATURE_SELECTION.md:283:y_test = pd.read_csv("data/processed/y_test_optimized.csv").values.ravel()
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:5:El dataset de entrenamiento pasó de **10 features simples** a **37 features avanzadas**:
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:84:logs_count, metrics_count, has_data
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:85:logs_count_normalized, metrics_count_normalized
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:114:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:115:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:118:with open('data/processed/feature_names.txt') as f:
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:173:   ls data/processed/X_*.csv
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:179:   wc -l data/processed/feature_names.txt
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:185:   python -c "import pandas as pd; df = pd.read_csv('data/processed/X_train.csv'); print(f'Nulls: {df.isnull().sum().sum()}')"
MB-Chat\docs\QUICKSTART_ENRICHED_FEATURES.md:240:1. ✓ Generar dataset: `python scripts/data_pipeline.py`
MB-Whatsapp\data\incidents.json:16:        "logs": [
MB-Whatsapp\data\incidents.json:60:        "logs": [
MB-Whatsapp\data\incidents.json:109:        "logs": [
MB-Whatsapp\data\incidents.json:154:        "logs": [
MB-Whatsapp\data\incidents.json:196:        "logs": [
MB-Whatsapp\data\incidents.json:236:        "logs": [
MB-Whatsapp\data\incidents.json:287:        "logs": [
MB-Whatsapp\data\incidents.json:332:        "logs": [
MB-Whatsapp\data\incidents.json:383:        "logs": [
MB-Whatsapp\data\incidents.json:424:        "logs": [
MB-Whatsapp\data\incidents.json:468:        "logs": [
MB-Whatsapp\data\incidents.json:515:        "logs": [
MB-Whatsapp\data\incidents.json:561:        "logs": [
MB-Whatsapp\data\incidents.json:605:        "logs": [
MB-Whatsapp\data\incidents.json:646:        "logs": [
MB-Whatsapp\data\incidents.json:688:        "logs": [
MB-Whatsapp\data\incidents.json:734:        "logs": [
MB-Whatsapp\data\incidents.json:781:        "logs": [
MB-Whatsapp\data\incidents.json:826:        "logs": [
MB-Whatsapp\data\incidents.json:871:        "logs": [
MB-Whatsapp\data\incidents.json:916:        "logs": [
MB-Whatsapp\data\incidents.json:962:        "logs": [
MB-Whatsapp\data\incidents.json:1008:        "logs": [
MB-Whatsapp\data\incidents.json:1048:        "logs": [
MB-Whatsapp\data\incidents.json:1090:        "logs": [
MB-Whatsapp\data\incidents.json:1132:        "logs": [],
MB-Whatsapp\data\incidents.json:1170:        "logs": [
MB-Whatsapp\data\incidents.json:1213:        "logs": [
MB-Whatsapp\data\incidents.json:1253:        "logs": [
MB-Whatsapp\data\incidents.json:1299:        "logs": [
MB-Whatsapp\data\incidents.json:1342:        "logs": [],
MB-Whatsapp\data\incidents.json:1380:        "logs": [
MB-Whatsapp\data\incidents.json:1425:        "logs": [
MB-Whatsapp\data\incidents.json:1469:        "logs": [
MB-Whatsapp\data\incidents.json:1512:        "logs": [
MB-Whatsapp\data\incidents.json:1558:        "logs": [
MB-Whatsapp\data\incidents.json:1602:        "logs": [
MB-Whatsapp\data\incidents.json:1649:        "logs": [
MB-Whatsapp\data\incidents.json:1690:        "logs": [
MB-Whatsapp\data\incidents.json:1732:        "logs": [
MB-Whatsapp\data\incidents.json:1773:        "logs": [
MB-Whatsapp\data\incidents.json:1819:        "logs": [
MB-Whatsapp\data\incidents.json:1863:        "logs": [
MB-Whatsapp\data\incidents.json:1904:        "logs": [
MB-Whatsapp\data\incidents.json:1951:        "logs": [
MB-Whatsapp\data\incidents.json:1998:        "logs": [
MB-Whatsapp\data\incidents.json:2041:        "logs": [
MB-Whatsapp\data\incidents.json:2083:        "logs": [
MB-Whatsapp\data\incidents.json:2130:        "logs": [
MB-Whatsapp\data\incidents.json:2177:        "logs": [
MB-Whatsapp\data\incidents.json:2221:        "logs": [
MB-Whatsapp\data\incidents.json:2267:        "logs": [
MB-Whatsapp\data\incidents.json:2313:        "logs": [
MB-Whatsapp\data\incidents.json:2358:        "logs": [
MB-Whatsapp\data\incidents.json:2408:        "logs": [
MB-Whatsapp\data\incidents.json:2450:        "logs": [
MB-Whatsapp\data\incidents.json:2492:        "logs": [
MB-Whatsapp\data\incidents.json:2542:        "logs": [
MB-Whatsapp\data\incidents.json:2589:        "logs": [
MB-Whatsapp\data\incidents.json:2636:        "logs": [
MB-Whatsapp\data\incidents.json:2682:        "logs": [
MB-Whatsapp\data\incidents.json:2727:        "logs": [
MB-Whatsapp\data\incidents.json:2774:        "logs": [
MB-Whatsapp\data\incidents.json:2822:        "logs": [
MB-Whatsapp\data\incidents.json:2866:        "logs": [
MB-Whatsapp\data\incidents.json:2908:        "logs": [
MB-Whatsapp\data\incidents.json:2957:        "logs": [
MB-Whatsapp\data\incidents.json:3001:        "logs": [
MB-Whatsapp\data\incidents.json:3050:        "logs": [
MB-Whatsapp\data\incidents.json:3099:        "logs": [],
MB-Whatsapp\data\incidents.json:3137:        "logs": [
MB-Whatsapp\data\incidents.json:3187:        "logs": [
MB-Whatsapp\data\incidents.json:3237:        "logs": [
MB-Whatsapp\data\incidents.json:3284:        "logs": [
MB-Whatsapp\data\incidents.json:3332:        "logs": [
MB-Whatsapp\data\incidents.json:3379:        "logs": [
MB-Whatsapp\data\incidents.json:3424:        "logs": [
MB-Whatsapp\data\incidents.json:3469:        "logs": [
MB-Whatsapp\data\incidents.json:3517:        "logs": [
MB-Whatsapp\data\incidents.json:3560:        "logs": [
MB-Whatsapp\data\incidents.json:3600:        "logs": [
MB-Whatsapp\data\incidents.json:3650:        "logs": [
MB-Whatsapp\data\incidents.json:3699:        "logs": [
MB-Whatsapp\data\incidents.json:3743:        "logs": [
MB-Whatsapp\data\incidents.json:3787:        "logs": [],
MB-Whatsapp\data\incidents.json:3825:        "logs": [
MB-Whatsapp\data\incidents.json:3874:        "logs": [
MB-Whatsapp\data\incidents.json:3917:        "logs": [
MB-Whatsapp\data\incidents.json:3964:        "logs": [
MB-Whatsapp\data\incidents.json:4008:        "logs": [
MB-Whatsapp\data\incidents.json:4058:        "logs": [
MB-Whatsapp\data\incidents.json:4104:        "logs": [
MB-Whatsapp\data\incidents.json:4149:        "logs": [
MB-Whatsapp\data\incidents.json:4196:        "logs": [
MB-Whatsapp\data\incidents.json:4246:        "logs": [
MB-Whatsapp\data\incidents.json:4289:        "logs": [
MB-Whatsapp\data\incidents.json:4337:        "logs": [
MB-Whatsapp\data\incidents.json:4383:        "logs": [
MB-Whatsapp\data\incidents.json:4428:        "logs": [
MB-Whatsapp\data\incidents.json:4477:        "logs": [
MB-Whatsapp\data\incidents.json:4518:        "logs": [
MB-Whatsapp\data\incidents.json:4565:        "logs": [
MB-Whatsapp\data\incidents.json:4611:        "logs": [
MB-Whatsapp\data\incidents.json:4658:        "logs": [
MB-Whatsapp\data\incidents.json:4703:        "logs": [
MB-Whatsapp\data\incidents.json:4748:        "logs": [
MB-Whatsapp\data\incidents.json:4794:        "logs": [
MB-Whatsapp\data\incidents.json:4838:        "logs": [
MB-Whatsapp\data\incidents.json:4883:        "logs": [
MB-Whatsapp\data\incidents.json:4924:        "logs": [
MB-Whatsapp\data\incidents.json:4973:        "logs": [
MB-Whatsapp\data\incidents.json:5021:        "logs": [
MB-Whatsapp\data\incidents.json:5069:        "logs": [
MB-Whatsapp\data\incidents.json:5117:        "logs": [
MB-Whatsapp\data\incidents.json:5168:        "logs": [
MB-Whatsapp\data\incidents.json:5215:        "logs": [
MB-Whatsapp\data\incidents.json:5259:        "logs": [
MB-Whatsapp\data\incidents.json:5306:        "logs": [
MB-Whatsapp\data\incidents.json:5357:        "logs": [
MB-Whatsapp\data\incidents.json:5403:        "logs": [
MB-Whatsapp\data\incidents.json:5451:        "logs": [
MB-Whatsapp\data\incidents.json:5495:        "logs": [
MB-Whatsapp\data\incidents.json:5541:        "logs": [
MB-Whatsapp\data\incidents.json:5588:        "logs": [
MB-Whatsapp\data\incidents.json:5636:        "logs": [
MB-Whatsapp\data\incidents.json:5684:        "logs": [
MB-Whatsapp\data\incidents.json:5732:        "logs": [
MB-Whatsapp\data\incidents.json:5776:        "logs": [
MB-Whatsapp\data\incidents.json:5819:        "logs": [
MB-Whatsapp\data\incidents.json:5868:        "logs": [
MB-Whatsapp\data\incidents.json:5911:        "logs": [
MB-Whatsapp\data\incidents.json:5959:        "logs": [
MB-Whatsapp\data\incidents.json:6005:        "logs": [
MB-Whatsapp\data\incidents.json:6050:        "logs": [
MB-Whatsapp\data\incidents.json:6098:        "logs": [],
MB-Whatsapp\data\incidents.json:6136:        "logs": [
MB-Whatsapp\data\incidents.json:6180:        "logs": [
MB-Whatsapp\data\incidents.json:6223:        "logs": [
MB-Whatsapp\data\incidents.json:6271:        "logs": [
MB-Whatsapp\data\incidents.json:6318:        "logs": [
MB-Whatsapp\data\incidents.json:6365:        "logs": [
MB-Whatsapp\data\incidents.json:6408:        "logs": [
MB-Whatsapp\data\incidents.json:6460:        "logs": [
MB-Whatsapp\data\incidents.json:6510:        "logs": [
MB-Whatsapp\data\incidents.json:6558:        "logs": [
MB-Whatsapp\data\incidents.json:6607:        "logs": [
MB-Whatsapp\data\incidents.json:6651:        "logs": [
MB-Whatsapp\data\incidents.json:6696:        "logs": [
MB-Whatsapp\data\incidents.json:6742:        "logs": [
MB-Whatsapp\data\incidents.json:6783:        "logs": [
MB-Whatsapp\data\incidents.json:6828:        "logs": [
MB-Whatsapp\data\incidents.json:6870:        "logs": [
MB-Whatsapp\data\incidents.json:6917:        "logs": [
MB-Whatsapp\data\incidents.json:6968:        "logs": [
MB-Whatsapp\data\incidents.json:7016:        "logs": [
MB-Whatsapp\data\incidents.json:7063:        "logs": [
MB-Whatsapp\data\incidents.json:7110:        "logs": [
MB-Whatsapp\data\incidents.json:7160:        "logs": [
MB-Whatsapp\data\incidents.json:7208:        "logs": [
MB-Whatsapp\data\incidents.json:7256:        "logs": [
MB-Whatsapp\data\incidents.json:7301:        "logs": [
MB-Whatsapp\data\incidents.json:7341:        "logs": [
MB-Whatsapp\data\incidents.json:7391:        "logs": [
MB-Whatsapp\data\incidents.json:7435:        "logs": [
MB-Whatsapp\data\incidents.json:7483:        "logs": [
MB-Whatsapp\data\incidents.json:7530:        "logs": [
MB-Whatsapp\data\incidents.json:7576:        "logs": [
MB-Whatsapp\data\incidents.json:7621:        "logs": [
MB-Whatsapp\data\incidents.json:7666:        "logs": [
MB-Whatsapp\data\incidents.json:7710:        "logs": [
MB-Whatsapp\data\incidents.json:7755:        "logs": [
MB-Whatsapp\data\incidents.json:7804:        "logs": [
MB-Whatsapp\data\incidents.json:7846:        "logs": [
MB-Whatsapp\data\incidents.json:7890:        "logs": [
MB-Whatsapp\data\incidents.json:7932:        "logs": [
MB-Whatsapp\data\incidents.json:7977:        "logs": [
MB-Whatsapp\data\incidents.json:8023:        "logs": [
MB-Whatsapp\data\incidents.json:8069:        "logs": [
MB-Whatsapp\data\incidents.json:8119:        "logs": [
MB-Whatsapp\data\incidents.json:8162:        "logs": [
MB-Whatsapp\data\incidents.json:8204:        "logs": [
MB-Whatsapp\data\incidents.json:8250:        "logs": [
MB-Whatsapp\data\incidents.json:8297:        "logs": [
MB-Whatsapp\data\incidents.json:8340:        "logs": [
MB-Whatsapp\data\incidents.json:8386:        "logs": [
MB-Whatsapp\data\incidents.json:8433:        "logs": [
MB-Whatsapp\data\incidents.json:8479:        "logs": [
MB-Whatsapp\data\incidents.json:8525:        "logs": [
MB-Whatsapp\data\incidents.json:8573:        "logs": [
MB-Whatsapp\data\incidents.json:8619:        "logs": [
MB-Whatsapp\data\incidents.json:8670:        "logs": [
MB-Whatsapp\data\incidents.json:8711:        "logs": [
MB-Whatsapp\data\incidents.json:8754:        "logs": [
MB-Whatsapp\data\incidents.json:8801:        "logs": [
MB-Whatsapp\data\incidents.json:8848:        "logs": [
MB-Whatsapp\data\incidents.json:8895:        "logs": [
MB-Whatsapp\data\incidents.json:8942:        "logs": [
MB-Whatsapp\data\incidents.json:8987:        "logs": [
MB-Whatsapp\data\incidents.json:9029:        "logs": [
MB-Whatsapp\data\incidents.json:9075:        "logs": [
MB-Whatsapp\data\incidents.json:9122:        "logs": [
MB-Whatsapp\data\incidents.json:9167:        "logs": [
MB-Whatsapp\data\incidents.json:9213:        "logs": [
MB-Whatsapp\data\incidents.json:9255:        "logs": [
MB-Whatsapp\data\incidents.json:9304:        "logs": [
MB-Whatsapp\data\incidents.json:9346:        "logs": [
MB-Whatsapp\data\incidents.json:9389:        "logs": [
MB-Whatsapp\data\incidents.json:9435:        "logs": [
MB-Whatsapp\data\incidents.json:9486:        "logs": [
MB-Whatsapp\data\incidents.json:9534:        "logs": [
MB-Whatsapp\data\incidents.json:9582:        "logs": [
MB-Whatsapp\data\incidents.json:9624:        "logs": [
MB-Whatsapp\data\incidents.json:9671:        "logs": [
MB-Whatsapp\data\incidents.json:9719:        "logs": [
MB-Whatsapp\data\incidents.json:9770:        "logs": [
MB-Whatsapp\data\incidents.json:9818:        "logs": [
MB-Whatsapp\data\incidents.json:9869:        "logs": [
MB-Whatsapp\data\incidents.json:9910:        "logs": [
MB-Whatsapp\data\incidents.json:9960:        "logs": [
MB-Whatsapp\data\incidents.json:10003:        "logs": [
MB-Whatsapp\data\incidents.json:10051:        "logs": [
MB-Whatsapp\data\incidents.json:10098:        "logs": [
MB-Whatsapp\data\incidents.json:10147:        "logs": [
MB-Whatsapp\data\incidents.json:10200:        "logs": [
MB-Whatsapp\data\incidents.json:10245:        "logs": [
MB-Whatsapp\data\incidents.json:10292:        "logs": [
MB-Whatsapp\data\incidents.json:10337:        "logs": [
MB-Whatsapp\data\incidents.json:10384:        "logs": [
MB-Whatsapp\data\incidents.json:10428:        "logs": [
MB-Whatsapp\data\incidents.json:10473:        "logs": [
MB-Whatsapp\data\incidents.json:10521:        "logs": [
MB-Whatsapp\data\incidents.json:10567:        "logs": [
MB-Whatsapp\data\incidents.json:10613:        "logs": [
MB-Whatsapp\data\incidents.json:10656:        "logs": [
MB-Whatsapp\data\incidents.json:10700:        "logs": [
MB-Whatsapp\data\incidents.json:10748:        "logs": [
MB-Whatsapp\data\incidents.json:10798:        "logs": [
MB-Whatsapp\data\incidents.json:10845:        "logs": [
MB-Whatsapp\data\incidents.json:10892:        "logs": [
MB-Whatsapp\data\incidents.json:10940:        "logs": [
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:14:- **Output datasets ready:** ✅ Yes (3 variants prepared)
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:75:    'full': 'data/processed/X_train_optimized.csv',
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:76:    'top80': 'data/processed/X_train_top80_importance.csv',
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:114:    # Load datasets
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:116:        X_train = pd.read_csv('data/processed/X_train_optimized.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:117:        X_test = pd.read_csv('data/processed/X_test_optimized.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:119:        X_train = pd.read_csv('data/processed/X_train_top80_importance.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:120:        X_test = pd.read_csv('data/processed/X_test_top80_importance.csv')
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:124:    y_train = pd.read_csv('data/processed/y_train_optimized.csv').values.ravel()
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:125:    y_test = pd.read_csv('data/processed/y_test_optimized.csv').values.ravel()
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:380:- Check for vector operations bottlenecks
MB-Chat\docs\PHASE_3_ACTION_PLAN.md:418:python -c "import pandas as pd; print(pd.read_csv('data/processed/X_train_optimized.csv').shape)"
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:23:- Produced ready-to-use optimized datasets
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:74:- **Data availability**: logs_count, metrics_count
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:94:Sample Count:           1 train, 1 test (demo dataset)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:387:- [x] Production datasets prepared
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:468:- Encoder/scaler artifacts: ~5MB total
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:530:3. **Production-ready datasets** with zero quality issues
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:551:- `data/processed/X_train_optimized.csv` (37 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:552:- `data/processed/X_test_optimized.csv` (37 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:553:- `data/processed/X_train_top80_importance.csv` (31 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:554:- `data/processed/X_test_top80_importance.csv` (31 features)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:555:- `data/processed/feature_names_*.txt` (Feature metadata)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:556:- `data/processed/y_train*.csv` / `y_test*.csv` (Labels)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:559:- `data/processed/feature_encoders.pkl` (LabelEncoders)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:560:- `data/processed/action_encoder.pkl` (Action space)
MB-Chat\docs\PHASES_1_2_COMPLETION_SUMMARY.md:561:- `data/processed/feature_scaler.pkl` (Normalization)
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:99:│     │     └─ DEPLOYMENT BLOCKED (pero artifacts guardados)   │
MB-Chat\docs\ONLINE_LEARNING_ARCHITECTURE.md:248:  3. combine_datasets()
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:9:### 1. ✅ Model Registry (`scripts/model_registry.py`)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:227:from model_registry import ModelRegistry
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:256:python scripts/demo_model_registry.py
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:273:| `num_train_samples` | Tamaño dataset entrenamiento |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:274:| `num_test_samples` | Tamaño dataset test |
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:323:├── model_registry.py       (420 líneas)
MB-Chat\docs\MODEL_EVOLUTION_SUMMARY.md:326:├── demo_model_registry.py  (250 líneas)
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:41:- k = min(5, len(train_data)) - Adapta a datasets pequeños
MB-Chat\docs\ML_VALIDATION_SUMMARY.md:197:- Precision/recall/F1 metrics por dataset
MB-Whatsapp\src\ml-core\feature-builder.ts:42:  'logs_count',
MB-Whatsapp\src\ml-core\feature-builder.ts:45:  'logs_count_normalized',
MB-Whatsapp\src\ml-core\feature-builder.ts:122:    const logs = Array.isArray(metadata.logs) ? metadata.logs : [];
MB-Whatsapp\src\ml-core\feature-builder.ts:149:    byName.logs_count = logs.length;
MB-Whatsapp\src\ml-core\feature-builder.ts:152:    byName.logs_count_normalized = this.clamp(logs.length / 50);
MB-Whatsapp\src\ml-core\feature-builder.ts:177:    const vector = this.metadata.feature_names.map((name) => this.ensureNumeric(byName[name]));
MB-Whatsapp\src\ml-core\feature-builder.ts:179:    if (vector.length !== this.metadata.num_features) {
MB-Whatsapp\src\ml-core\feature-builder.ts:181:        `Feature length mismatch: expected ${this.metadata.num_features}, got ${vector.length}`,
MB-Whatsapp\src\ml-core\feature-builder.ts:185:    return vector;
MB-Whatsapp\src\ml-core\feature-builder.ts:202:  /** Returns the zero-based index of a feature name in the model's feature vector, or -1 if not found. */
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:34:- **Context (6)**: logs_count, metrics_count, has_data, severity (inferred), + normalized versions
MB-Chat\docs\ML_VALIDATION_PRODUCTION.md:448:data/processed/
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:368:with open('data/processed/feature_names.txt') as f:
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:403:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\ML_VALIDATION_INTEGRATION.md:404:y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\src\common\utils\error-parser.util.ts:17:  const logs = asLowercaseList(input.metadata?.logs);
MB-Chat\src\common\utils\error-parser.util.ts:19:  if (errors.some((entry) => entry.includes('timeout')) && logs.some((entry) => entry.includes('postgres'))) {
MB-Chat\src\common\utils\error-parser.util.spec.ts:14:        logs: ['postgres connection pool exhausted'],
MB-Chat\docs\ML_MODEL_REGISTRY.md:43:### 1. Model Registry (`scripts/model_registry.py`)
MB-Chat\docs\ML_MODEL_REGISTRY.md:290:python scripts/model_registry.py
MB-Chat\docs\ML_MODEL_REGISTRY.md:298:from model_registry import ModelRegistry
MB-Chat\docs\ML_MODEL_REGISTRY.md:408:3. **Registers with model_registry.py**
MB-Chat\docs\ML_MODEL_REGISTRY.md:491:python -c "from model_registry import ModelRegistry; \
MB-Chat\docs\ML_MODEL_REGISTRY.md:499:python -c "from model_registry import ModelRegistry; \
MB-Chat\docs\ML_MODEL_REGISTRY.md:599:- Clear any Python import caches
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:55:- **Change**: Accepts enriched feature vector, not just hour/day
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:155:3. Monitor logs for `[COMBINED_SCORE]` patterns
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:173:- Minimal (insights cached per decision)
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:206:| Debuggable decisions | ✅ | Full breakdown in logs |
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:244:- **Monitoring**: Check logs for `[COMBINED_SCORE]` patterns
MB-Chat\docs\ML_INTELLIGENCE_PHASE6_SUMMARY.md:245:- **Debugging**: Review decision scoring breakdown in logs
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:5:Se ha expandido significativamente el dataset de entrenamiento pasando de **10 features simples** a **37 features avanzadas**, eliminando la dependencia de variables temporales básicas y capturando contexto real, comportamiento histórico y señales de comportamiento.
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:68:| `logs_count` | Número de logs disponibles | 0-∞ | Data richness |
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:71:| `logs_count_normalized` | logs_count normalizado | 0-1 | ML-ready |
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:75:**Beneficio:** El contexto rico (logs/métricas) determina confiabilidad de features y decisiones.
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:119:  "logs_count": 0,
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:146:  "logs_count": 0,
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:149:  "logs_count_normalized": 0,
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:219:data/processed/
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:275:# 5. Guarda datasets en data/processed/
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:286:X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:287:y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:294:X_train_scaled = pd.read_csv('data/processed/X_train_scaled.csv')
MB-Chat\docs\FEATURE_ENGINEERING_ENRICHED.md:311:with open('data/processed/feature_names.txt') as f:
MB-Chat\src\common\types\brain.types.ts:21:  | 'clear_cache'
MB-Chat\docs\ML_FEATURES.md:34:| `logs_count` | int | Cantidad de logs disponibles |
MB-Chat\docs\ML_FEATURES.md:88:[Context Calculation] → severity, logs_count, metrics_count
MB-Chat\docs\ML_FEATURES.md:168:Con dataset muy pequeño (1-2 muestras por clase):
MB-Chat\docs\DIALOGUE_ENGINE_INTEGRATION.md:287:Dialogue-service produce logs JSON en formato:
MB-Chat\docs\CONTEXT_EXAMPLE.py:16:        'logs': [log1, log2, log3],
MB-Chat\docs\CONTEXT_EXAMPLE.py:40:logs_count = 3        # Hay logs disponibles
MB-Chat\docs\CONTEXT_EXAMPLE.py:56:    3,       # logs_count
MB-Chat\docs\CONTEXT_EXAMPLE.py:128:   - has_data=1, logs_count=3 → "información suficiente → actuar"
MB-Chat\docs\CONTEXT_EXAMPLE.py:129:   - has_data=0, logs_count=0 → "no hay contexto → ser cauteloso"
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:204:grep -i "ESCALATE" logs/*.log
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:211:grep -i "ML_ACCURACY_RECORD" logs/*.log | wc -l
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:212:# Compare with [COMBINED_SCORE] logs to see ratio
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:273:2. **Root Cause**: Check logs
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:296:- [ ] ML accuracy tracking logs appear
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:321:1. Check `[COMBINED_SCORE]` logs for breakdown
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:322:2. Verify ML model exists and loads (model_service logs)
MB-Chat\docs\MIGRATION_ML_PRIMARY_SOURCE.md:325:5. Compare rules vs ML accuracy in logs
MB-Chat\docs\CONTEXT_ENRICHMENT.md:10:- Contexto: logs, metrics, has_data, 7 categóricas
MB-Chat\docs\CONTEXT_ENRICHMENT.md:27:   - logs_count, metrics_count, has_data
MB-Chat\docs\CONTEXT_ENRICHMENT.md:186:✅ Dataset generado: `data/processed/X_train.csv` (18 cols)
MB-Chat\docs\CONTEXT_ENRICHMENT.md:189:✅ Features name guardadas: `data/processed/feature_names.txt`
MB-Chat\docs\FILE_MANIFEST.md:14:3. **[QUICKSTART_FEATURE_SELECTION.md](QUICKSTART_FEATURE_SELECTION.md)** - How to use datasets
MB-Chat\docs\FILE_MANIFEST.md:75:data/processed/
MB-Chat\docs\FILE_MANIFEST.md:94:data/processed/
MB-Chat\docs\FILE_MANIFEST.md:113:└── processed/
MB-Chat\docs\FILE_MANIFEST.md:317:| 28 | logs_count | Context | 2.21% |
MB-Chat\docs\FILE_MANIFEST.md:327:| 34 | logs_count_normalized | Behavior | 2.21% |
MB-Chat\docs\FILE_MANIFEST.md:337:2. Load data from data/processed/X_train_optimized.csv
MB-Chat\docs\FILE_MANIFEST.md:383:  Training datasets:             ✅ Ready
MB-Chat\docs\FILE_MANIFEST.md:384:  Test datasets:                 ✅ Ready
MB-Chat\docs\FILE_MANIFEST.md:406:│   └── processed/
MB-Chat\docs\FILE_MANIFEST.md:454:(Expandable to GBs with full incident dataset)
MB-Chat\docs\COMPLETION_CHECKLIST.md:18:├─ Context: logs_count, metrics_count, has_data
MB-Chat\docs\COMPLETION_CHECKLIST.md:34:│  ├─ Datos: logs_count, metrics_count, has_data, *_normalized
MB-Chat\docs\COMPLETION_CHECKLIST.md:47:data/processed/
MB-Chat\docs\COMPLETION_CHECKLIST.md:56:✅ metadata.json            (meta)  - Info del dataset
MB-Chat\docs\COMPLETION_CHECKLIST.md:201:# Genera: 37 features, dataset limpio, encoders
MB-Chat\docs\COMPLETION_CHECKLIST.md:324:✅ 0 null values en dataset limpio
MB-Chat\docs\COMPLETION_CHECKLIST.md:371:- [x] ✅ Generar dataset enriquecido
MB-Chat\docs\COMPLETION_CHECKLIST.md:426:- Dataset: `data/processed/X_train.csv` (37 features)
MB-Chat\docs\COMPLETION_CHECKLIST.md:427:- Features: `data/processed/feature_names.txt`
MB-Chat\nlu_engine.py:27:    cached_at: datetime = field(default_factory=datetime.utcnow)
MB-Chat\nlu_engine.py:42:    """In-memory cache de lecciones por doctor con TTL."""
MB-Chat\nlu_engine.py:45:        self._cache: dict[str, list[CachedLesson]] = {}
MB-Chat\nlu_engine.py:49:        if doctor_id not in self._cache:
MB-Chat\nlu_engine.py:51:        lessons = self._cache[doctor_id]
MB-Chat\nlu_engine.py:55:        cached_time = lessons[0].cached_at
MB-Chat\nlu_engine.py:56:        if datetime.utcnow() - cached_time > self._ttl:
MB-Chat\nlu_engine.py:57:            del self._cache[doctor_id]
MB-Chat\nlu_engine.py:62:        self._cache[doctor_id] = lessons
MB-Chat\nlu_engine.py:66:            self._cache.pop(doctor_id, None)
MB-Chat\nlu_engine.py:68:            self._cache.clear()
MB-Chat\nlu_engine.py:127:    _lesson_cache: LessonCache = LessonCache(ttl_seconds=300)
MB-Chat\nlu_engine.py:266:            cached = cls._lesson_cache.get(doctor_id)
MB-Chat\nlu_engine.py:267:            if cached is None:
MB-Chat\nlu_engine.py:284:                            cls._lesson_cache.set(doctor_id, lessons)
MB-Chat\nlu_engine.py:288:                lessons = cached
MB-Chat\nlu_engine.py:360:    def clear_knowledge_cache(cls, doctor_id: Optional[str] = None) -> None:
MB-Chat\nlu_engine.py:361:        cls._lesson_cache.clear(doctor_id)
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:11:The feature selection pipeline analyzed the 37-feature dataset to identify which features drive model predictions and eliminate redundancy. With theoretical importance scoring (demo data has single action class), we identified:
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:104:- **80/20 Rule**: Just 31 features (84% of dataset) capture 80% of predictive power
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:163:| logs_count | 2.21% | Data availability |
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:196:Keeping all features maintains information diversity. Feature pruning would only reduce interpretability without computational benefit (with current small dataset size).
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:294:✅ **data/processed/X_train_optimized.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:295:✅ **data/processed/X_test_optimized.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:296:✅ **data/processed/feature_names_optimized.txt**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:300:✅ **data/processed/X_train_top80_importance.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:301:✅ **data/processed/X_test_top80_importance.csv**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:302:✅ **data/processed/feature_names_top80_importance.txt**
MB-Chat\docs\FEATURE_SELECTION_ANALYSIS.md:328:Since the demo dataset contains only a single action class, we applied **theoretical feature importance** based on:
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:11:Expandir significativamente el dataset de ML eliminando dependencia de variables temporales simples y capturando **contexto real** y **comportamiento histórico** para mejorar generalización y reducir overfitting.
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:45:logs_count, metrics_count, has_data
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:46:logs_count_normalized, metrics_count_normalized
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:94:- Ejemplos de feature vectors
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:115:- Resultado: 0 valores nulos en dataset final
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:161:  37-feature CSV dataset
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:186:  - Contexto disponible (logs, métricas)
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:207:data/processed/
MB-Chat\docs\FEATURE_EXPANSION_SUMMARY.md:236:1. ✅ Generar dataset enriquecido
MB-Chat\retrieval\index.ts:24:  notes: ["MetaBrain Nest usa embeddings hash; Next usa allowlist y sanitizer."],
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:12:Expand ML dataset from **10 basic features** → **37 advanced features**
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:81:  • logs_count, metrics_count (raw counts)
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:110:data/processed/
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:181:├── Example vectors
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:407:✅ 0 null values in cleaned dataset
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:411:✅ dataset ready for training
MB-Chat\docs\FEATURE_EXPANSION_DASHBOARD.md:444:✅ data/processed/* (dataset)
MB-Chat\README.md:25:   - Features enriquecidas: severity, logs_count, metrics_count, frequency, encodings categóricos
MB-Chat\README.md:119:**Contexto** (4): logs_count, metrics_count, has_data, source_category
MB-Chat\README.md:200:data/processed/
MB-Chat\README.md:270:3. **Model Registry** (`scripts/model_registry.py`)
MB-Chat\README.md:334:python -c "from model_registry import ModelRegistry; \
MB-Chat\README.md:338:python scripts/demo_model_registry.py
MB-Chat\README.md:375:tail -f logs/app.log | grep "COMBINED_SCORE"
MB-Chat\README.md:378:tail -f logs/app.log | grep "ESCALATE"
MB-Chat\README.md:381:grep "ML_ACCURACY_RECORD" logs/app.log | head -20
MB-Chat\README.md:386:# Visible en logs:
MB-Chat\README.md:387:tail -f logs/app.log | grep "Learning.*Retraining"
MB-Chat\README.md:397:python -c "from model_registry import ModelRegistry; \
MB-Chat\README.md:404:python scripts/demo_model_registry.py
MB-Chat\src\action-engine\action.service.spec.ts:24:      action: 'clear_cache',
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:101:      logs: ['double booking attempt', 'conflict resolution failed'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:115:      logs: ['booking conflict detected'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:130:      logs: ['timeout', 'connection reset'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:143:      logs: ['ECONNREFUSED 127.0.0.1:5432', 'timeout acquiring client'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:156:      logs: ['generic error log'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:169:      logs: ['partial error'],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:194:      logs: [],
MB-Chat\src\brain\brain.mixed-traffic.spec.ts:262:            logs: ((event.payload as Record<string, unknown>)?.logs as string[]) || [],
MB-Chat\memory_py\types.py:43:    vector_enabled: bool = False
MB-Chat\src\brain\brain.high-load.spec.ts:149:              logs: ['load-test'],
MB-Chat\src\brain\brain.high-load.spec.ts:279:    const processedCount = records.filter((r) => !r.crashed).length;
MB-Chat\src\brain\brain.high-load.spec.ts:287:      events_processed: processedCount,
MB-Chat\src\brain\brain.high-load.spec.ts:306:    expect(summary.events_processed).toBe(INCIDENT_COUNT);
MB-Chat\memory_py\semantic_memory_service.py:30:        vector_enabled=_read_bool(values.get("SEMANTIC_MEMORY_VECTOR_ENABLED"), False),
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:76:    logs: [
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:153:          message: payload.logs[0],
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:156:            logs: payload.logs,
MB-Chat\src\brain\brain.db-outage.simulation.spec.ts:180:  // ── Contract: all incidents processed ──────────────────────────────────────
MB-Chat\memory_py\jsonl_adapter.py:158:                "embedding_slot": record.get("embedding_slot"),
MB-Chat\providers_py\types.py:9:ProviderRequestType = Literal["chat", "completion", "embedding", "vision", "multimodal", "healthcheck"]
MB-Chat\src\audit\audit.service.ts:18:  private readonly logs: AuditEntity[] = [];
MB-Chat\src\audit\audit.service.ts:25:      this.logs.push(...records);
MB-Chat\src\audit\audit.service.ts:26:      this.logger.log(`[Audit] Loaded ${this.logs.length} audit records from database`);
MB-Chat\src\audit\audit.service.ts:58:    return this.logs;
MB-Chat\src\audit\audit.service.ts:63:    this.logs.push(sanitizedEntity);
MB-Chat\src\audit\audit.service.ts:64:    if (this.logs.length > MAX_AUDIT_ENTRIES) {
MB-Chat\src\audit\audit.service.ts:65:      this.logs.shift();
MB-Chat\PATIENT_HISTORY_ACCESS_CONTRACT_RESULT.md:10:- Contract errors are surfaced as stable errorClass codes in logs:
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:100:- `memory/SemanticMemoryService` sigue fuera del root de build Nest; la memoria semantica operativa de esta fase vive en `MedicalChatLearningService` con recall lexical JSONL. Si se quiere vectorizacion real, hay que integrar esa capa al arbol compilado y al DI de Nest.
MB-Chat\HYBRID_MEDICAL_AI_LEARNING_AUDIT.md:124:- NO-GO para declarar independencia fuerte de Groq: aun existe teacher fallback y el recall sigue siendo lexical, no vectorial.
MB-Chat\memory\index.ts:8:export * from "./vector-backend.contract";
MB-Chat\memory\index.ts:15:  vectorBackend: "contract_only",
MB-Chat\memory\feature-flags.ts:6:  vectorEnabled: false,
MB-Chat\memory\feature-flags.ts:35:    vectorEnabled: readBoolean(env.SEMANTIC_MEMORY_VECTOR_ENABLED, DEFAULT_MEMORY_FEATURE_FLAGS.vectorEnabled),
MB-Chat\data\synthetic_dataset\incidents.json:16:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:60:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:109:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:154:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:196:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:236:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:287:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:332:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:383:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:424:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:468:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:515:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:561:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:605:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:646:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:688:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:734:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:781:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:826:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:871:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:916:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:962:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1008:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1048:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1090:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1132:        "logs": [],
MB-Chat\data\synthetic_dataset\incidents.json:1170:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1213:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1253:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1299:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1342:        "logs": [],
MB-Chat\data\synthetic_dataset\incidents.json:1380:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1425:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1469:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1512:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1558:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1602:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1649:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1690:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1732:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1773:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1819:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1863:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1904:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1951:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:1998:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2041:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2083:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2130:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2177:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2221:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2267:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2313:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2358:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2408:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2450:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2492:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2542:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2589:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2636:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2682:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2727:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2774:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2822:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2866:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2908:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:2957:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3001:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3050:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3099:        "logs": [],
MB-Chat\data\synthetic_dataset\incidents.json:3137:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3187:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3237:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3284:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3332:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3379:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3424:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3469:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3517:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3560:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3600:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3650:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3699:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3743:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3787:        "logs": [],
MB-Chat\data\synthetic_dataset\incidents.json:3825:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3874:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3917:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:3964:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4008:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4058:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4104:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4149:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4196:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4246:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4289:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4337:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4383:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4428:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4477:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4518:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4565:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4611:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4658:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4703:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4748:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4794:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4838:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4883:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4924:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:4973:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5021:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5069:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5117:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5168:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5215:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5259:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5306:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5357:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5403:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5451:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5495:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5541:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5588:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5636:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5684:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5732:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5776:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5819:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5868:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5911:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:5959:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6005:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6050:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6098:        "logs": [],
MB-Chat\data\synthetic_dataset\incidents.json:6136:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6180:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6223:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6271:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6318:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6365:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6408:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6460:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6510:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6558:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6607:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6651:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6696:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6742:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6783:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6828:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6870:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6917:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:6968:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7016:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7063:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7110:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7160:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7208:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7256:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7301:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7341:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7391:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7435:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7483:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7530:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7576:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7621:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7666:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7710:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7755:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7804:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7846:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7890:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7932:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:7977:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8023:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8069:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8119:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8162:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8204:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8250:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8297:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8340:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8386:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8433:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8479:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8525:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8573:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8619:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8670:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8711:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8754:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8801:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8848:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8895:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8942:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:8987:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9029:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9075:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9122:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9167:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9213:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9255:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9304:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9346:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9389:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9435:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9486:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9534:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9582:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9624:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9671:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9719:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9770:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9818:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9869:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9910:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:9960:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10003:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10051:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10098:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10147:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10200:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10245:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10292:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10337:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10384:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10428:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10473:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10521:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10567:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10613:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10656:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10700:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10748:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10798:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10845:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10892:        "logs": [
MB-Chat\data\synthetic_dataset\incidents.json:10940:        "logs": [
MB-Chat\memory\jsonl-memory-adapter.ts:174:        embedding_slot: record.embedding_slot,
MB-Chat\models\anomaly_model_metadata.json:21:    "logs_count",
MB-Chat\src\ai\providers\groq.provider.ts:85:  // LRU-style bounded response cache (keyed by prompt SHA-256)
MB-Chat\src\ai\providers\groq.provider.ts:86:  private readonly cache = new Map<string, CacheEntry>();
MB-Chat\src\ai\providers\groq.provider.ts:124:  private cacheKey(prompt: string): string {
MB-Chat\src\ai\providers\groq.provider.ts:128:  private cacheGet(key: string): AiAnalysisResult | undefined {
MB-Chat\src\ai\providers\groq.provider.ts:129:    const entry = this.cache.get(key);
MB-Chat\src\ai\providers\groq.provider.ts:132:      this.cache.delete(key);
MB-Chat\src\ai\providers\groq.provider.ts:138:  private cacheSet(key: string, value: AiAnalysisResult): void {
MB-Chat\src\ai\providers\groq.provider.ts:139:    if (this.cache.size >= CACHE_MAX_SIZE) {
MB-Chat\src\ai\providers\groq.provider.ts:141:      const firstKey = this.cache.keys().next().value;
MB-Chat\src\ai\providers\groq.provider.ts:142:      if (firstKey !== undefined) this.cache.delete(firstKey);
MB-Chat\src\ai\providers\groq.provider.ts:144:    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
MB-Chat\src\ai\providers\groq.provider.ts:311:  // ── Public: runAnalysis (with cache + circuit breaker + quality validation) ──
MB-Chat\src\ai\providers\groq.provider.ts:319:    const key = this.cacheKey(prompt);
MB-Chat\src\ai\providers\groq.provider.ts:320:    const cached = this.cacheGet(key);
MB-Chat\src\ai\providers\groq.provider.ts:321:    if (cached) {
MB-Chat\src\ai\providers\groq.provider.ts:322:      this.logger.debug('[AI:cache] HIT — returning cached analysis');
MB-Chat\src\ai\providers\groq.provider.ts:323:      return cached;
MB-Chat\src\ai\providers\groq.provider.ts:359:          this.cacheSet(key, result);
MB-Chat\cerebro_ai_med\tests\test_stepc_health_observability.py:63:    assert checks["model_registry_exists"] is True
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:14:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Chat\cerebro_ai_med\tests\test_inference_production.py:48:def test_model_loader_and_runtime_inference_with_persisted_artifacts(active_model_spec) -> None:
MB-Chat\cerebro_ai_med\tests\test_inference_hardening.py:16:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Chat\metabrain\prompt_loader.py:35:        self._cache: dict[str, _CachedPrompt] = {}
MB-Chat\metabrain\prompt_loader.py:60:    def clear_cache(self) -> None:
MB-Chat\metabrain\prompt_loader.py:62:            self._cache.clear()
MB-Chat\metabrain\prompt_loader.py:82:            cached = self._cache.get(filename)
MB-Chat\metabrain\prompt_loader.py:83:            if cached is not None and cached.mtime == stat.st_mtime:
MB-Chat\metabrain\prompt_loader.py:84:                return cached.content
MB-Chat\metabrain\prompt_loader.py:99:            self._cache[filename] = _CachedPrompt(mtime=stat.st_mtime, content=content)
MB-Chat\cerebro_ai_med\tests\integration_distributed_real.py:76:    memory_file = Path("e:/MetaBrain/data/processed/memory_history_real_validation.jsonl")
MB-Chat\cerebro_ai_med\tests\integration_distributed_real.py:112:        assert history["items"][-1]["embedding_slot"]["status"] == "pending"
MB-Chat\cerebro_ai_med\tests\integration_distributed_real.py:113:        assert history["items"][-1]["embedding_slot"]["vector_ref"]
MB-Chat\cerebro_ai_med\README.md:21:- models/artifacts/text/{version}/text_risk_pipeline.joblib
MB-Chat\cerebro_ai_med\README.md:22:- models/artifacts/image/{version}/image_risk_pipeline.joblib
MB-Chat\cerebro_ai_med\README.md:23:- models/artifacts/metadata.json
MB-Chat\data\processed\X_val.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_train_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_train_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_train.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_test_top80_importance.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,incidents_last_1h,incidents_last_24h,incidents_last_7d,rolling_frequency,logs_count,metrics_count,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_test_optimized.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\X_test.csv:1:hour_of_day,day_of_week,day_of_month,month,time_since_last_min,time_since_last_normalized,incidents_last_1h,incidents_last_24h,incidents_last_7d,incidents_1h_normalized,incidents_24h_normalized,incidents_7d_normalized,rolling_frequency,logs_count,metrics_count,has_data,logs_count_normalized,metrics_count_normalized,success_rate_last_10,failure_rate_last_10,success_rate_today,action_historical_success_rate,type_action_success_rate,last_action_success,retry_count_1h,retry_count_normalized,escalation_flag,action_effectiveness_score,incident_type_encoded,source_encoded,original_type_encoded,diagnosis_code_encoded,strategy_encoded,severity_encoded,action_type_encoded,source_category_encoded,last_action_taken_encoded
MB-Chat\data\processed\sequence_metadata.json:20:    "logs_count",
MB-Chat\cerebro_ai_med\models\train_models.py:15:from cerebro_ai_med.models.training_data import build_image_dataset, build_text_dataset
MB-Chat\cerebro_ai_med\models\train_models.py:18:ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MB-Chat\cerebro_ai_med\models\train_models.py:25:    dataset = build_text_dataset()
MB-Chat\cerebro_ai_med\models\train_models.py:27:        dataset.texts,
MB-Chat\cerebro_ai_med\models\train_models.py:28:        dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:31:        stratify=dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:36:            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
MB-Chat\cerebro_ai_med\models\train_models.py:62:    dataset = build_image_dataset(seed=42, n_per_class=260)
MB-Chat\cerebro_ai_med\models\train_models.py:64:        dataset.features,
MB-Chat\cerebro_ai_med\models\train_models.py:65:        dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:68:        stratify=dataset.labels,
MB-Chat\cerebro_ai_med\models\train_models.py:73:            ("vectorizer", DictVectorizer(sparse=False)),
MB-Chat\cerebro_ai_med\models\train_models.py:124:        "artifacts": {
MB-Chat\cerebro_ai_med\models\train_models.py:164:        "artifacts": {
MB-Chat\cerebro_ai_med\models\training_data.py:23:def build_text_dataset() -> TextDataset:
MB-Chat\cerebro_ai_med\models\training_data.py:95:def build_image_dataset(seed: int = 42, n_per_class: int = 240) -> ImageDataset:
MB-Chat\cerebro_ai_med\models\service.py:3:from functools import lru_cache
MB-Chat\cerebro_ai_med\models\service.py:8:@lru_cache(maxsize=1)
MB-Chat\cerebro_ai_med\models\registry.py:66:            if "artifacts" in lowered:
MB-Chat\cerebro_ai_med\models\registry.py:67:                artifact_index = lowered.index("artifacts")
MB-Chat\cerebro_ai_med\models\registry.py:79:    artifacts = entry.get("artifacts", {})
MB-Chat\cerebro_ai_med\models\registry.py:80:    text = artifacts.get("text", {})
MB-Chat\cerebro_ai_med\models\registry.py:81:    image = artifacts.get("image", {})
MB-Chat\cerebro_ai_med\models\ml_model.py:21:    return Path(os.path.join(os.path.dirname(__file__), "artifacts")).resolve()
MB-Chat\cerebro_ai_med\models\ml_model.py:174:        vectorizer = self._state.text_pipeline.named_steps["vectorizer"]
MB-Chat\cerebro_ai_med\models\ml_model.py:177:        x = vectorizer.transform([text])
MB-Chat\data\processed\metadata.json:2:  "dataset_type": "synthetic",
MB-Chat\data\processed\metadata.json:3:  "input_dir": "E:\\MetaBrain\\data\\synthetic_dataset",
MB-Chat\data\processed\memory_history_real_validation.jsonl:1:{"entry_id": "e3e95698-41e3-479c-afe3-0d327f45bb80", "request_id": "69d9ce38-b954-4dc3-843b-0ee02f57ae90", "source": "sync", "created_at_utc": "2026-04-21T20:43:02.394421Z", "input_summary": {"source_type": "text", "modality": "TEXT", "text_length": 60}, "model_output": {"model_name": "production_medical_triage", "model_version": "3.0.0", "risk_level": "medium", "finding_code": "needs_clinical_review", "confidence": 0.486075, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation", "features_used": {"token_count": 9.0, "char_count": 60.0, "active_ngrams": 9.0}}, "decision_output": {"risk_level": "high", "clinical_flag": "urgent", "requires_medical_evaluation": true, "suspected_condition": "pneumonia_possible", "clinical_interpretation": "Patron radiologico compatible con proceso infeccioso pulmonar. Requiere correlacion clinica, examen fisico y confirmacion medica.", "action_plan": "urgent_er_referral", "urgency": "immediate", "follow_up_hours": 0, "red_flags": [], "recommended_tests": ["chest_xray_followup", "cbc", "crp", "pulse_oximetry"], "model_evidence": {"finding": "possible_pneumonia", "finding_code": "needs_clinical_review", "model_risk_level": "medium", "modality": "XRAY", "confidence": 0.4861, "probabilities": {"low": 0.214325, "medium": 0.486075, "high": 0.299601}, "recommendation_code": "priority_evaluation"}}, "nlg_output": {"text": "El analisis integra hallazgos compatibles con un escenario de riesgo elevado. Existe evidencia indirecta de probable compromiso respiratorio infeccioso. Debe activarse circuito de atencion urgente para confirmacion y manejo. Nivel de confianza del modelo: 0.49. Pruebas sugeridas: chest_xray_followup, cbc, crp, pulse_oximetry.", "style": "technical", "variants_used": ["El analisis integra hallazgos compatibles con un escenario de riesgo elevado.", "Existe evidencia indirecta de probable compromiso respiratorio infeccioso.", "Debe activarse circuito de atencion urgente para confirmacion y manejo."], "disclaimers": ["Salida automatizada de apoyo clinico; no reemplaza criterio medico.", "Requiere correlacion con historia clinica, examen fisico y estudios complementarios."]}, "fallback_used": false, "embedding_slot": {"embedding_id": "6abcd183-1dbd-4527-b6b3-a0573c9e492a", "status": "pending", "model_name": "reserved_for_future_embedding_model", "dimensions": null, "vector_ref": "memory_embeddings/sync/42d6d96c-bbec-4a98-b769-956f4397c1f1", "created_at_utc": "2026-04-21T20:43:02.394444Z"}}
MB-Chat\data\processed\feature_names_top80_importance.txt:21:logs_count
MB-Chat\data\processed\feature_names_top80_importance.txt:23:logs_count_normalized
MB-Whatsapp\cerebro_ai_med\tests\test_stepc_health_observability.py:63:    assert checks["model_registry_exists"] is True
MB-Chat\data\processed\feature_names_optimized.txt:14:logs_count
MB-Chat\data\processed\feature_names_optimized.txt:17:logs_count_normalized
MB-Chat\data\processed\feature_names.txt:14:logs_count
MB-Chat\data\processed\feature_names.txt:17:logs_count_normalized
MB-Chat\metabrain\metrics.py:18:            "cache_hits_total": 0,
MB-Chat\metabrain\metrics.py:19:            "cache_misses_total": 0,
MB-Chat\metabrain\metrics.py:30:    def record_cache_hit(self) -> None:
MB-Chat\metabrain\metrics.py:32:            self._stats["cache_hits_total"] += 1
MB-Chat\metabrain\metrics.py:34:    def record_cache_miss(self) -> None:
MB-Chat\metabrain\metrics.py:36:            self._stats["cache_misses_total"] += 1
MB-Chat\metabrain\metrics.py:66:        cache_lookups = int(snapshot.get("cache_hits_total", 0)) + int(snapshot.get("cache_misses_total", 0))
MB-Chat\metabrain\metrics.py:72:        if cache_lookups > 0:
MB-Chat\metabrain\metrics.py:73:            hit_rate = float(snapshot.get("cache_hits_total", 0)) / float(cache_lookups)
MB-Chat\metabrain\metrics.py:76:        snapshot["cache_hit_rate"] = round(hit_rate, 4)
MB-Chat\metabrain\logger.py:44:    """Emit logs as one JSON object per line."""
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:14:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Whatsapp\cerebro_ai_med\tests\test_inference_production.py:48:def test_model_loader_and_runtime_inference_with_persisted_artifacts(active_model_spec) -> None:
MB-Chat\metabrain\groq_client.py:1:"""Production-grade Groq client with secure config, timeout, metrics, and cache."""
MB-Chat\metabrain\groq_client.py:10:from metabrain.cache import GLOBAL_CACHE, InMemoryTTLCache, build_cache_key
MB-Chat\metabrain\groq_client.py:45:    from_cache: bool = False
MB-Chat\metabrain\groq_client.py:56:        cache: InMemoryTTLCache | None = None,
MB-Chat\metabrain\groq_client.py:61:        self._cache = cache or GLOBAL_CACHE
MB-Chat\metabrain\groq_client.py:97:        use_cache: bool = True,
MB-Chat\metabrain\groq_client.py:107:        cache_key = build_cache_key(
MB-Chat\metabrain\groq_client.py:116:        if use_cache:
MB-Chat\metabrain\groq_client.py:117:            cached = self._cache.get(cache_key)
MB-Chat\metabrain\groq_client.py:118:            if cached is not None and isinstance(cached, PromptResponse):
MB-Chat\metabrain\groq_client.py:119:                self._metrics.record_cache_hit()
MB-Chat\metabrain\groq_client.py:121:                    text=cached.text,
MB-Chat\metabrain\groq_client.py:122:                    model=cached.model,
MB-Chat\metabrain\groq_client.py:123:                    latency_ms=cached.latency_ms,
MB-Chat\metabrain\groq_client.py:124:                    prompt_tokens=cached.prompt_tokens,
MB-Chat\metabrain\groq_client.py:125:                    completion_tokens=cached.completion_tokens,
MB-Chat\metabrain\groq_client.py:126:                    total_tokens=cached.total_tokens,
MB-Chat\metabrain\groq_client.py:127:                    from_cache=True,
MB-Chat\metabrain\groq_client.py:129:            self._metrics.record_cache_miss()
MB-Chat\metabrain\groq_client.py:157:                from_cache=False,
MB-Chat\metabrain\groq_client.py:165:            if use_cache:
MB-Chat\metabrain\groq_client.py:166:                self._cache.set(cache_key, prompt_response)
MB-Chat\metabrain\groq_client.py:288:    use_cache: bool = True,
MB-Chat\metabrain\groq_client.py:298:        use_cache=use_cache,
MB-Whatsapp\cerebro_ai_med\tests\test_inference_hardening.py:16:ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "models" / "artifacts"
MB-Chat\metabrain\config.py:7:from functools import lru_cache
MB-Chat\metabrain\config.py:67:    nlg_cache_ttl_seconds: int = 300
MB-Chat\metabrain\config.py:68:    nlg_cache_max_entries: int = 256
MB-Chat\metabrain\config.py:90:@lru_cache(maxsize=1)
MB-Chat\metabrain\config.py:126:        nlg_cache_ttl_seconds=_parse_int(
MB-Chat\metabrain\config.py:132:        nlg_cache_max_entries=_parse_int(
MB-Chat\metabrain\config.py:144:    get_settings.cache_clear()
MB-Chat\metabrain\cache.py:1:"""Simple in-memory TTL cache to avoid repeated Groq calls."""
MB-Chat\metabrain\cache.py:22:    """Small process-local cache with TTL + max-size eviction."""
MB-Chat\metabrain\cache.py:72:def build_cache_key(*parts: str) -> str:
MB-Chat\metabrain\cache.py:81:def _get_or_create_global_cache() -> InMemoryTTLCache:
MB-Chat\metabrain\cache.py:87:                max_entries=settings.nlg_cache_max_entries,
MB-Chat\metabrain\cache.py:88:                ttl_seconds=settings.nlg_cache_ttl_seconds,
MB-Chat\metabrain\cache.py:93:GLOBAL_CACHE = _get_or_create_global_cache()
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:9:  "artifacts": {
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:10:    "text": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\text\\3.0.0\\text_risk_pipeline.joblib",
MB-Chat\cerebro_ai_med\models\artifacts\model_metadata.json:11:    "image": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\image\\3.0.0\\image_risk_pipeline.joblib"
MB-Chat\models\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\cerebro_ai_med\tests\integration_distributed_real.py:76:    memory_file = Path("e:/MetaBrain/data/processed/memory_history_real_validation.jsonl")
MB-Whatsapp\cerebro_ai_med\tests\integration_distributed_real.py:112:        assert history["items"][-1]["embedding_slot"]["status"] == "pending"
MB-Whatsapp\cerebro_ai_med\tests\integration_distributed_real.py:113:        assert history["items"][-1]["embedding_slot"]["vector_ref"]
MB-Chat\data\model-registry.json:11:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache"],
MB-Chat\data\model-registry.json:24:        "classes": ["restart_postgres", "retry_with_backoff", "clear_cache", "scale_up"],
MB-Chat\cerebro_ai_med\models\artifacts\metadata.json:13:      "artifacts": {
MB-Chat\src\ai\medical-imaging.service.ts:53:    const preprocessed = this.preprocessImage(input.imageBase64, input.mimeType);
MB-Chat\src\ai\medical-imaging.service.ts:74:          image_base64: preprocessed.payloadBase64,
MB-Chat\src\ai\medical-imaging.service.ts:75:          mime_type: preprocessed.mimeType,
MB-Chat\src\ai\medical-imaging.service.ts:95:      const modality = this.normalizeModality(data.imageType ?? input.modalityHint, preprocessed.mimeType);
MB-Chat\data\medical-chat-learning.jsonl:22:{"id":"doctor-chat-1778987314149","recordedAt":"2026-05-17T03:08:34.149Z","source":"doctor_chat_frontend","doctorId":"lab-doctor","conversationId":"doctor:lab-doctor:patient:general:appointment:none:chat:3dc78180-0766-48d8-961c-a55abf2f8585","patientId":null,"appointmentId":null,"userMessage":"📊 Resolución Analítica y Matemática del CasoPaso 1: Análisis del Equilibrio Ácido-Base (El Trastorno Mixto)El estado de la paciente revela un trastorno ácido-base mixto clásico por salicilatos: una alcalosis respiratoria primaria combinada con una acidosis metabólica con brecha aniónica (anion gap) elevada. El pH final es de \\(7.41\\) debido a que ambos trastornos se contraponen vectorialmente.Fisiopatología de la alcalosis respiratoria: Los salicilatos estimulan de forma directa el centro respiratorio en el bulbo raquídeo. Esto genera hiperventilación (taquipnea profunda de Kussmaul, FR: \\(32\\text{ rpm}\\)), barriendo masivamente el dióxido de carbono y bajando la \\(\\text{PaCO}_{2}\\) a \\(20\\text{ mmHg}\\).Fisiopatología de la acidosis metabólica: El salicilato desacopla la fosforilación oxidativa en las mitocondrias. Esto obliga al cuerpo a depender de la glucólisis anaeróbica, acumulando ácido láctico y cuerpos cetónicos, lo que consume el bicarbonato pulmonar y lo desciende a \\(12\\text{ mEq/L}\\).Paso 2: Cálculo Químico de Permeabilidad (Henderson-Hasselbalch)Aplicamos la ecuación para determinar la fracción de fármaco ionizado (\\(\\text{A}^{-}\\)) frente al no ionizado (\\(\\text{HA}\\)):\\(\\text{pH}=\\text{pK}_{a}+\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\)\\(7.41=3.5+\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\implies 3.91=\\log \\left(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}\\right)\\)\\(\\frac{[\\text{A}^{-}]}{[\\text{HA}]}=10^{3.91}\\approx 8128\\)Interpretación clínica: A un \\(\\text{pH}\\) plasmático de \\(7.41\\), por cada molécula de ácido acetilsalicílico no ionizada (\\(\\text{HA}\\)), hay aproximadamente \\(8,128\\) moléculas ionizadas (\\(\\text{A}^{-}\\)).Mecanismo de neuroprotección: Solo la forma no ionizada (\\(\\text{HA}\\)) es liposoluble y cruza la barrera hematoencefálica. Si el \\(\\text{pH}\\) de la sangre disminuye (acidemia), la ecuación se desplaza hacia la izquierda, incrementando la forma \\(\\text{HA}\\) y aumentando dramáticamente la entrada de la toxina al ce","assistantResponse":"Resumen clínico actualizado\nPaciente femenina de 24 años con intento de autolisis por ácido acetilsalicílico (Aspirina). Presenta un trastorno ácido-base mixto: alcalosis respiratoria primaria y acidosis metabólica con brecha aniónica elevada. El pH es de 7.41 debido a la compensación vectorial de ambos trastornos.\nHipotesis actualizada\n1.  Intoxicación grave por ácido acetilsalicílico con trastorno ácido-base mixto.\n2.  Alcalinización urinaria y potenciación de la eliminación renal.\nFactores de riesgo\n- Intento de autolisis.\n- Nivel crítico/tóxico de salicilato.\nRed flags\n- Agitación.\n- Diaforesis.\n- Acúfenos.\n- Alteraciones en los gases arteriales (GSA).\nEvidencia utilizada\n- Datos clínicos y de laboratorio proporcionados.\nSugerencias de evaluación\n1.  Monitoreo continuo de los signos vitales y la concentración sérica de salicilato.\n2.  Iniciar tratamiento con bicarbonato de sodio para alcalinizar la orina y potenciar la eliminación renal.\n3.  Considerar la cinética de eliminación para ajustar el tratamiento.\nLimitaciones\n- No se dispone de información adicional sobre la paciente.\nDisclaimer clinico\nLa evaluación y el manejo del paciente deben realizarse en el contexto de su historial clínico completo y los recursos disponibles. La monitorización estrecha y la respuesta a las intervenciones son cruciales."}
MB-Whatsapp\cerebro_ai_med\README.md:21:- models/artifacts/text/{version}/text_risk_pipeline.joblib
MB-Whatsapp\cerebro_ai_med\README.md:22:- models/artifacts/image/{version}/image_risk_pipeline.joblib
MB-Whatsapp\cerebro_ai_med\README.md:23:- models/artifacts/metadata.json
MB-Chat\models\model_metrics.json:50:    "logs_count",
MB-Chat\models\model_metrics.json:53:    "logs_count_normalized",
MB-Chat\data\incidents.json:16:        "logs": [
MB-Chat\data\incidents.json:60:        "logs": [
MB-Chat\data\incidents.json:109:        "logs": [
MB-Chat\data\incidents.json:154:        "logs": [
MB-Chat\data\incidents.json:196:        "logs": [
MB-Chat\data\incidents.json:236:        "logs": [
MB-Chat\data\incidents.json:287:        "logs": [
MB-Chat\data\incidents.json:332:        "logs": [
MB-Chat\data\incidents.json:383:        "logs": [
MB-Chat\data\incidents.json:424:        "logs": [
MB-Chat\data\incidents.json:468:        "logs": [
MB-Chat\data\incidents.json:515:        "logs": [
MB-Chat\data\incidents.json:561:        "logs": [
MB-Chat\data\incidents.json:605:        "logs": [
MB-Chat\data\incidents.json:646:        "logs": [
MB-Chat\data\incidents.json:688:        "logs": [
MB-Chat\data\incidents.json:734:        "logs": [
MB-Chat\data\incidents.json:781:        "logs": [
MB-Chat\data\incidents.json:826:        "logs": [
MB-Chat\data\incidents.json:871:        "logs": [
MB-Chat\data\incidents.json:916:        "logs": [
MB-Chat\data\incidents.json:962:        "logs": [
MB-Chat\data\incidents.json:1008:        "logs": [
MB-Chat\data\incidents.json:1048:        "logs": [
MB-Chat\data\incidents.json:1090:        "logs": [
MB-Chat\data\incidents.json:1132:        "logs": [],
MB-Chat\data\incidents.json:1170:        "logs": [
MB-Chat\data\incidents.json:1213:        "logs": [
MB-Chat\data\incidents.json:1253:        "logs": [
MB-Chat\data\incidents.json:1299:        "logs": [
MB-Chat\data\incidents.json:1342:        "logs": [],
MB-Chat\data\incidents.json:1380:        "logs": [
MB-Chat\data\incidents.json:1425:        "logs": [
MB-Chat\data\incidents.json:1469:        "logs": [
MB-Chat\data\incidents.json:1512:        "logs": [
MB-Chat\data\incidents.json:1558:        "logs": [
MB-Chat\data\incidents.json:1602:        "logs": [
MB-Chat\data\incidents.json:1649:        "logs": [
MB-Chat\data\incidents.json:1690:        "logs": [
MB-Chat\data\incidents.json:1732:        "logs": [
MB-Chat\data\incidents.json:1773:        "logs": [
MB-Chat\data\incidents.json:1819:        "logs": [
MB-Chat\data\incidents.json:1863:        "logs": [
MB-Chat\data\incidents.json:1904:        "logs": [
MB-Chat\data\incidents.json:1951:        "logs": [
MB-Chat\data\incidents.json:1998:        "logs": [
MB-Chat\data\incidents.json:2041:        "logs": [
MB-Chat\data\incidents.json:2083:        "logs": [
MB-Chat\data\incidents.json:2130:        "logs": [
MB-Chat\data\incidents.json:2177:        "logs": [
MB-Chat\data\incidents.json:2221:        "logs": [
MB-Chat\data\incidents.json:2267:        "logs": [
MB-Chat\data\incidents.json:2313:        "logs": [
MB-Chat\data\incidents.json:2358:        "logs": [
MB-Chat\data\incidents.json:2408:        "logs": [
MB-Chat\data\incidents.json:2450:        "logs": [
MB-Chat\data\incidents.json:2492:        "logs": [
MB-Chat\data\incidents.json:2542:        "logs": [
MB-Chat\data\incidents.json:2589:        "logs": [
MB-Chat\data\incidents.json:2636:        "logs": [
MB-Chat\data\incidents.json:2682:        "logs": [
MB-Chat\data\incidents.json:2727:        "logs": [
MB-Chat\data\incidents.json:2774:        "logs": [
MB-Chat\data\incidents.json:2822:        "logs": [
MB-Chat\data\incidents.json:2866:        "logs": [
MB-Chat\data\incidents.json:2908:        "logs": [
MB-Chat\data\incidents.json:2957:        "logs": [
MB-Chat\data\incidents.json:3001:        "logs": [
MB-Chat\data\incidents.json:3050:        "logs": [
MB-Chat\data\incidents.json:3099:        "logs": [],
MB-Chat\data\incidents.json:3137:        "logs": [
MB-Chat\data\incidents.json:3187:        "logs": [
MB-Chat\data\incidents.json:3237:        "logs": [
MB-Chat\data\incidents.json:3284:        "logs": [
MB-Chat\data\incidents.json:3332:        "logs": [
MB-Chat\data\incidents.json:3379:        "logs": [
MB-Chat\data\incidents.json:3424:        "logs": [
MB-Chat\data\incidents.json:3469:        "logs": [
MB-Chat\data\incidents.json:3517:        "logs": [
MB-Chat\data\incidents.json:3560:        "logs": [
MB-Chat\data\incidents.json:3600:        "logs": [
MB-Chat\data\incidents.json:3650:        "logs": [
MB-Chat\data\incidents.json:3699:        "logs": [
MB-Chat\data\incidents.json:3743:        "logs": [
MB-Chat\data\incidents.json:3787:        "logs": [],
MB-Chat\data\incidents.json:3825:        "logs": [
MB-Chat\data\incidents.json:3874:        "logs": [
MB-Chat\data\incidents.json:3917:        "logs": [
MB-Chat\data\incidents.json:3964:        "logs": [
MB-Chat\data\incidents.json:4008:        "logs": [
MB-Chat\data\incidents.json:4058:        "logs": [
MB-Chat\data\incidents.json:4104:        "logs": [
MB-Chat\data\incidents.json:4149:        "logs": [
MB-Chat\data\incidents.json:4196:        "logs": [
MB-Chat\data\incidents.json:4246:        "logs": [
MB-Chat\data\incidents.json:4289:        "logs": [
MB-Chat\data\incidents.json:4337:        "logs": [
MB-Chat\data\incidents.json:4383:        "logs": [
MB-Chat\data\incidents.json:4428:        "logs": [
MB-Chat\data\incidents.json:4477:        "logs": [
MB-Chat\data\incidents.json:4518:        "logs": [
MB-Chat\data\incidents.json:4565:        "logs": [
MB-Chat\data\incidents.json:4611:        "logs": [
MB-Chat\data\incidents.json:4658:        "logs": [
MB-Chat\data\incidents.json:4703:        "logs": [
MB-Chat\data\incidents.json:4748:        "logs": [
MB-Chat\data\incidents.json:4794:        "logs": [
MB-Chat\data\incidents.json:4838:        "logs": [
MB-Chat\data\incidents.json:4883:        "logs": [
MB-Chat\data\incidents.json:4924:        "logs": [
MB-Chat\data\incidents.json:4973:        "logs": [
MB-Chat\data\incidents.json:5021:        "logs": [
MB-Chat\data\incidents.json:5069:        "logs": [
MB-Chat\data\incidents.json:5117:        "logs": [
MB-Chat\data\incidents.json:5168:        "logs": [
MB-Chat\data\incidents.json:5215:        "logs": [
MB-Chat\data\incidents.json:5259:        "logs": [
MB-Chat\data\incidents.json:5306:        "logs": [
MB-Chat\data\incidents.json:5357:        "logs": [
MB-Chat\data\incidents.json:5403:        "logs": [
MB-Chat\data\incidents.json:5451:        "logs": [
MB-Chat\data\incidents.json:5495:        "logs": [
MB-Chat\data\incidents.json:5541:        "logs": [
MB-Chat\data\incidents.json:5588:        "logs": [
MB-Chat\data\incidents.json:5636:        "logs": [
MB-Chat\data\incidents.json:5684:        "logs": [
MB-Chat\data\incidents.json:5732:        "logs": [
MB-Chat\data\incidents.json:5776:        "logs": [
MB-Chat\data\incidents.json:5819:        "logs": [
MB-Chat\data\incidents.json:5868:        "logs": [
MB-Chat\data\incidents.json:5911:        "logs": [
MB-Chat\data\incidents.json:5959:        "logs": [
MB-Chat\data\incidents.json:6005:        "logs": [
MB-Chat\data\incidents.json:6050:        "logs": [
MB-Chat\data\incidents.json:6098:        "logs": [],
MB-Chat\data\incidents.json:6136:        "logs": [
MB-Chat\data\incidents.json:6180:        "logs": [
MB-Chat\data\incidents.json:6223:        "logs": [
MB-Chat\data\incidents.json:6271:        "logs": [
MB-Chat\data\incidents.json:6318:        "logs": [
MB-Chat\data\incidents.json:6365:        "logs": [
MB-Chat\data\incidents.json:6408:        "logs": [
MB-Chat\data\incidents.json:6460:        "logs": [
MB-Chat\data\incidents.json:6510:        "logs": [
MB-Chat\data\incidents.json:6558:        "logs": [
MB-Chat\data\incidents.json:6607:        "logs": [
MB-Chat\data\incidents.json:6651:        "logs": [
MB-Chat\data\incidents.json:6696:        "logs": [
MB-Chat\data\incidents.json:6742:        "logs": [
MB-Chat\data\incidents.json:6783:        "logs": [
MB-Chat\data\incidents.json:6828:        "logs": [
MB-Chat\data\incidents.json:6870:        "logs": [
MB-Chat\data\incidents.json:6917:        "logs": [
MB-Chat\data\incidents.json:6968:        "logs": [
MB-Chat\data\incidents.json:7016:        "logs": [
MB-Chat\data\incidents.json:7063:        "logs": [
MB-Chat\data\incidents.json:7110:        "logs": [
MB-Chat\data\incidents.json:7160:        "logs": [
MB-Chat\data\incidents.json:7208:        "logs": [
MB-Chat\data\incidents.json:7256:        "logs": [
MB-Chat\data\incidents.json:7301:        "logs": [
MB-Chat\data\incidents.json:7341:        "logs": [
MB-Chat\data\incidents.json:7391:        "logs": [
MB-Chat\data\incidents.json:7435:        "logs": [
MB-Chat\data\incidents.json:7483:        "logs": [
MB-Chat\data\incidents.json:7530:        "logs": [
MB-Chat\data\incidents.json:7576:        "logs": [
MB-Chat\data\incidents.json:7621:        "logs": [
MB-Chat\data\incidents.json:7666:        "logs": [
MB-Chat\data\incidents.json:7710:        "logs": [
MB-Chat\data\incidents.json:7755:        "logs": [
MB-Chat\data\incidents.json:7804:        "logs": [
MB-Chat\data\incidents.json:7846:        "logs": [
MB-Chat\data\incidents.json:7890:        "logs": [
MB-Chat\data\incidents.json:7932:        "logs": [
MB-Chat\data\incidents.json:7977:        "logs": [
MB-Chat\data\incidents.json:8023:        "logs": [
MB-Chat\data\incidents.json:8069:        "logs": [
MB-Chat\data\incidents.json:8119:        "logs": [
MB-Chat\data\incidents.json:8162:        "logs": [
MB-Chat\data\incidents.json:8204:        "logs": [
MB-Chat\data\incidents.json:8250:        "logs": [
MB-Chat\data\incidents.json:8297:        "logs": [
MB-Chat\data\incidents.json:8340:        "logs": [
MB-Chat\data\incidents.json:8386:        "logs": [
MB-Chat\data\incidents.json:8433:        "logs": [
MB-Chat\data\incidents.json:8479:        "logs": [
MB-Chat\data\incidents.json:8525:        "logs": [
MB-Chat\data\incidents.json:8573:        "logs": [
MB-Chat\data\incidents.json:8619:        "logs": [
MB-Chat\data\incidents.json:8670:        "logs": [
MB-Chat\data\incidents.json:8711:        "logs": [
MB-Chat\data\incidents.json:8754:        "logs": [
MB-Chat\data\incidents.json:8801:        "logs": [
MB-Chat\data\incidents.json:8848:        "logs": [
MB-Chat\data\incidents.json:8895:        "logs": [
MB-Chat\data\incidents.json:8942:        "logs": [
MB-Chat\data\incidents.json:8987:        "logs": [
MB-Chat\data\incidents.json:9029:        "logs": [
MB-Chat\data\incidents.json:9075:        "logs": [
MB-Chat\data\incidents.json:9122:        "logs": [
MB-Chat\data\incidents.json:9167:        "logs": [
MB-Chat\data\incidents.json:9213:        "logs": [
MB-Chat\data\incidents.json:9255:        "logs": [
MB-Chat\data\incidents.json:9304:        "logs": [
MB-Chat\data\incidents.json:9346:        "logs": [
MB-Chat\data\incidents.json:9389:        "logs": [
MB-Chat\data\incidents.json:9435:        "logs": [
MB-Chat\data\incidents.json:9486:        "logs": [
MB-Chat\data\incidents.json:9534:        "logs": [
MB-Chat\data\incidents.json:9582:        "logs": [
MB-Chat\data\incidents.json:9624:        "logs": [
MB-Chat\data\incidents.json:9671:        "logs": [
MB-Chat\data\incidents.json:9719:        "logs": [
MB-Chat\data\incidents.json:9770:        "logs": [
MB-Chat\data\incidents.json:9818:        "logs": [
MB-Chat\data\incidents.json:9869:        "logs": [
MB-Chat\data\incidents.json:9910:        "logs": [
MB-Chat\data\incidents.json:9960:        "logs": [
MB-Chat\data\incidents.json:10003:        "logs": [
MB-Chat\data\incidents.json:10051:        "logs": [
MB-Chat\data\incidents.json:10098:        "logs": [
MB-Chat\data\incidents.json:10147:        "logs": [
MB-Chat\data\incidents.json:10200:        "logs": [
MB-Chat\data\incidents.json:10245:        "logs": [
MB-Chat\data\incidents.json:10292:        "logs": [
MB-Chat\data\incidents.json:10337:        "logs": [
MB-Chat\data\incidents.json:10384:        "logs": [
MB-Chat\data\incidents.json:10428:        "logs": [
MB-Chat\data\incidents.json:10473:        "logs": [
MB-Chat\data\incidents.json:10521:        "logs": [
MB-Chat\data\incidents.json:10567:        "logs": [
MB-Chat\data\incidents.json:10613:        "logs": [
MB-Chat\data\incidents.json:10656:        "logs": [
MB-Chat\data\incidents.json:10700:        "logs": [
MB-Chat\data\incidents.json:10748:        "logs": [
MB-Chat\data\incidents.json:10798:        "logs": [
MB-Chat\data\incidents.json:10845:        "logs": [
MB-Chat\data\incidents.json:10892:        "logs": [
MB-Chat\data\incidents.json:10940:        "logs": [
MB-Chat\models\model_dl_metadata.json:18:    "logs_count",
MB-Chat\models\model_dl_metadata.json:21:    "logs_count_normalized",
MB-Chat\providers\types.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
MB-Chat\providers\types.d.ts:2:export type ProviderRequestType = "chat" | "completion" | "embedding" | "vision" | "multimodal" | "healthcheck";
MB-Chat\models\feature_selection_report.json:42:    "logs_count",
MB-Chat\models\feature_selection_report.json:44:    "logs_count_normalized",
MB-Chat\cerebro_ai_med\memory\store.py:10:from cerebro_ai_med.memory.schemas import MemoryHistoryEntry, MemoryHistoryResponse, build_embedding_slot
MB-Chat\cerebro_ai_med\memory\store.py:41:            embedding_slot=build_embedding_slot(source=source),
MB-Chat\cerebro_ai_med\memory\schemas.py:13:    embedding_id: str
MB-Chat\cerebro_ai_med\memory\schemas.py:17:    vector_ref: str | None = None
MB-Chat\cerebro_ai_med\memory\schemas.py:33:    embedding_slot: EmbeddingSlot
MB-Chat\cerebro_ai_med\memory\schemas.py:43:def build_embedding_slot(source: str) -> EmbeddingSlot:
MB-Chat\cerebro_ai_med\memory\schemas.py:45:        embedding_id=str(uuid4()),
MB-Chat\cerebro_ai_med\memory\schemas.py:47:        model_name="reserved_for_future_embedding_model",
MB-Chat\cerebro_ai_med\memory\schemas.py:49:        vector_ref=f"memory_embeddings/{source}/{uuid4()}",
MB-Chat\models\feature_names.txt:14:logs_count
MB-Chat\models\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\cerebro_ai_med\api\security.py:6:from functools import lru_cache
MB-Whatsapp\cerebro_ai_med\api\security.py:46:@lru_cache(maxsize=1)
MB-Whatsapp\cerebro_ai_med\api\security.py:47:def get_security_settings_cached() -> SecuritySettings:
MB-Whatsapp\cerebro_ai_med\api\security.py:51:def clear_security_settings_cache() -> None:
MB-Whatsapp\cerebro_ai_med\api\security.py:52:    get_security_settings_cached.cache_clear()
MB-Whatsapp\cerebro_ai_med\api\security.py:59:    settings = getattr(request.app.state, "security_settings", None) or get_security_settings_cached()
MB-Chat\models\feature_importance_ranking.csv:22:logs_count,0.02214022140221402,2.214022140221402
MB-Chat\models\feature_importance_ranking.csv:24:logs_count_normalized,0.02214022140221402,2.214022140221402
MB-Chat\cerebro_ai_med\main.py:130:    security.clear_security_settings_cache()
MB-Chat\cerebro_ai_med\main.py:326:        "model_registry_exists": REGISTRY_PATH.exists(),
MB-Chat\cerebro_ai_med\main.py:346:            "model_registry_exists",
MB-Chat\models\feature_importance.json:176:      "feature": "logs_count_normalized",
MB-Chat\models\feature_importance.json:194:      "feature": "logs_count",
MB-Whatsapp\cerebro_ai_med\api\routes.py:107:                    "request_processed",
MB-Whatsapp\cerebro_ai_med\api\routes.py:174:                "request_processed",
MB-Whatsapp\cerebro_ai_med\api\routes.py:253:                "request_processed",
MB-Whatsapp\audit\README.md:8:- Seguridad clínica y PHI-safe logs.
MB-Whatsapp\audit\README.md:10:Fase 2 no cambia persistencia ni audit logs actuales.
MB-Chat\services\dialogue_engine\QUICKSTART.md:203:**Ver logs en tiempo real:**
MB-Chat\services\dialogue_engine\QUICKSTART.md:212:docker logs dialogue-service -f
MB-Chat\models\v12\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v12\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v12\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v12\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:15:from cerebro_ai_med.models.training_data import build_image_dataset, build_text_dataset
MB-Whatsapp\cerebro_ai_med\models\train_models.py:18:ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MB-Whatsapp\cerebro_ai_med\models\train_models.py:25:    dataset = build_text_dataset()
MB-Whatsapp\cerebro_ai_med\models\train_models.py:27:        dataset.texts,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:28:        dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:31:        stratify=dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:36:            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
MB-Whatsapp\cerebro_ai_med\models\train_models.py:62:    dataset = build_image_dataset(seed=42, n_per_class=260)
MB-Whatsapp\cerebro_ai_med\models\train_models.py:64:        dataset.features,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:65:        dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:68:        stratify=dataset.labels,
MB-Whatsapp\cerebro_ai_med\models\train_models.py:73:            ("vectorizer", DictVectorizer(sparse=False)),
MB-Whatsapp\cerebro_ai_med\models\train_models.py:124:        "artifacts": {
MB-Whatsapp\cerebro_ai_med\models\train_models.py:164:        "artifacts": {
MB-Chat\models\v12\metrics.json:50:    "logs_count",
MB-Chat\models\v12\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\.gitignore:8:__pycache__/
MB-Whatsapp\.gitignore:19:# Cobertura y logs
MB-Whatsapp\cerebro_ai_med\models\training_data.py:23:def build_text_dataset() -> TextDataset:
MB-Whatsapp\cerebro_ai_med\models\training_data.py:95:def build_image_dataset(seed: int = 42, n_per_class: int = 240) -> ImageDataset:
MB-Chat\models\v12\feature_names.txt:14:logs_count
MB-Chat\models\v12\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\cerebro_ai_med\models\service.py:3:from functools import lru_cache
MB-Whatsapp\cerebro_ai_med\models\service.py:8:@lru_cache(maxsize=1)
MB-Whatsapp\cerebro_ai_med\models\registry.py:66:            if "artifacts" in lowered:
MB-Whatsapp\cerebro_ai_med\models\registry.py:67:                artifact_index = lowered.index("artifacts")
MB-Whatsapp\cerebro_ai_med\models\registry.py:79:    artifacts = entry.get("artifacts", {})
MB-Whatsapp\cerebro_ai_med\models\registry.py:80:    text = artifacts.get("text", {})
MB-Whatsapp\cerebro_ai_med\models\registry.py:81:    image = artifacts.get("image", {})
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:21:    return Path(os.path.join(os.path.dirname(__file__), "artifacts")).resolve()
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:174:        vectorizer = self._state.text_pipeline.named_steps["vectorizer"]
MB-Whatsapp\cerebro_ai_med\models\ml_model.py:177:        x = vectorizer.transform([text])
MB-Chat\cerebro_ai_med\api\security.py:6:from functools import lru_cache
MB-Chat\cerebro_ai_med\api\security.py:46:@lru_cache(maxsize=1)
MB-Chat\cerebro_ai_med\api\security.py:47:def get_security_settings_cached() -> SecuritySettings:
MB-Chat\cerebro_ai_med\api\security.py:51:def clear_security_settings_cache() -> None:
MB-Chat\cerebro_ai_med\api\security.py:52:    get_security_settings_cached.cache_clear()
MB-Chat\cerebro_ai_med\api\security.py:59:    settings = getattr(request.app.state, "security_settings", None) or get_security_settings_cached()
MB-Chat\cerebro_ai_med\api\routes.py:107:                    "request_processed",
MB-Chat\cerebro_ai_med\api\routes.py:174:                "request_processed",
MB-Chat\cerebro_ai_med\api\routes.py:253:                "request_processed",
MB-Chat\models\v11\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v11\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v11\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v11\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\models\v11\metrics.json:50:    "logs_count",
MB-Chat\models\v11\metrics.json:53:    "logs_count_normalized",
MB-Chat\audit\README.md:8:- Seguridad clínica y PHI-safe logs.
MB-Chat\audit\README.md:10:Fase 2 no cambia persistencia ni audit logs actuales.
MB-Chat\models\v11\feature_names.txt:14:logs_count
MB-Chat\models\v11\feature_names.txt:17:logs_count_normalized
MB-Chat\.gitignore:8:__pycache__/
MB-Chat\.gitignore:19:# Cobertura y logs
MB-Whatsapp\cerebro_ai_med\main.py:130:    security.clear_security_settings_cache()
MB-Whatsapp\cerebro_ai_med\main.py:326:        "model_registry_exists": REGISTRY_PATH.exists(),
MB-Whatsapp\cerebro_ai_med\main.py:346:            "model_registry_exists",
MB-Whatsapp\cerebro_ai_med\memory\store.py:10:from cerebro_ai_med.memory.schemas import MemoryHistoryEntry, MemoryHistoryResponse, build_embedding_slot
MB-Whatsapp\cerebro_ai_med\memory\store.py:41:            embedding_slot=build_embedding_slot(source=source),
MB-Chat\models\v10\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v10\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v10\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v10\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:13:    embedding_id: str
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:17:    vector_ref: str | None = None
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:33:    embedding_slot: EmbeddingSlot
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:43:def build_embedding_slot(source: str) -> EmbeddingSlot:
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:45:        embedding_id=str(uuid4()),
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:47:        model_name="reserved_for_future_embedding_model",
MB-Whatsapp\cerebro_ai_med\memory\schemas.py:49:        vector_ref=f"memory_embeddings/{source}/{uuid4()}",
MB-Chat\models\v10\metrics.json:50:    "logs_count",
MB-Chat\models\v10\metrics.json:53:    "logs_count_normalized",
MB-Chat\models\v10\feature_names.txt:14:logs_count
MB-Chat\models\v10\feature_names.txt:17:logs_count_normalized
MB-Chat\services\decision_service\app\dependencies.py:5:from functools import lru_cache
MB-Chat\services\decision_service\app\dependencies.py:37:@lru_cache(maxsize=1)
MB-Chat\models\v15\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v15\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v15\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v15\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\models\v15\metrics.json:50:    "logs_count",
MB-Chat\models\v15\metrics.json:53:    "logs_count_normalized",
MB-Whatsapp\cerebro_ai_med\models\artifacts\metadata.json:13:      "artifacts": {
MB-Chat\services\nlg_service\app\main.py:21:    """Format logs as JSON for structured logging."""
MB-Chat\models\v15\feature_names.txt:14:logs_count
MB-Chat\models\v15\feature_names.txt:17:logs_count_normalized
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:9:  "artifacts": {
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:10:    "text": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\text\\3.0.0\\text_risk_pipeline.joblib",
MB-Whatsapp\cerebro_ai_med\models\artifacts\model_metadata.json:11:    "image": "E:\\MetaBrain\\cerebro_ai_med\\models\\artifacts\\image\\3.0.0\\image_risk_pipeline.joblib"
MB-Chat\scripts\analyze_features.py:4:Analyzes the enriched dataset and shows which features are most valuable
MB-Chat\scripts\analyze_features.py:18:    with open('data/processed/feature_names.txt') as f:
MB-Chat\scripts\analyze_features.py:27:    # Check if datasets exist
MB-Chat\scripts\analyze_features.py:28:    if not os.path.exists('data/processed/X_train.csv'):
MB-Chat\scripts\analyze_features.py:34:    print("\nLoading datasets...")
MB-Chat\scripts\analyze_features.py:35:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\analyze_features.py:36:    y_train = pd.read_csv('data/processed/y_train.csv')
MB-Chat\scripts\analyze_features.py:104:                      ['logs_count', 'metrics_count', 'has_data', 'severity'])]
MB-Chat\scripts\build_sequence_dataset.py:29:    'logs_count',
MB-Chat\scripts\build_sequence_dataset.py:140:    logs = metadata.get('logs', []) if isinstance(metadata.get('logs', []), list) else []
MB-Chat\scripts\build_sequence_dataset.py:161:        'logs_count': float(len(logs)),
MB-Chat\scripts\build_sequence_dataset.py:193:        'logs_count': 0.0,
MB-Chat\scripts\build_sequence_dataset.py:222:        'logs_count': 0.0,
MB-Chat\scripts\build_sequence_dataset.py:322:        'logs_count': float(event.get('logs_count', 0.0)),
MB-Chat\scripts\build_sequence_dataset.py:408:    parser = argparse.ArgumentParser(description='Build sequential anomaly dataset from system events')
MB-Chat\scripts\build_sequence_dataset.py:410:    parser.add_argument('--output-dir', default='data/processed', help='Directory to write X_sequences.npy and metadata')
MB-Chat\scripts\demo_model_registry.py:14:from model_registry import ModelRegistry
MB-Chat\scripts\data_pipeline.py:262:            logs_count = len(metadata.get('logs', []))
MB-Chat\scripts\data_pipeline.py:316:                'logs_count': logs_count,
MB-Chat\scripts\data_pipeline.py:319:                'logs_count_normalized': min(logs_count / 50.0, 1.0),
MB-Chat\scripts\data_pipeline.py:442:def create_dataset(input_dir='data/production_dataset', output_dir='data/processed', dataset_type='production'):
MB-Chat\scripts\data_pipeline.py:443:    """Create enriched ML dataset with advanced features"""
MB-Chat\scripts\data_pipeline.py:458:            "Run scripts/extract_real_dataset.py first or provide a valid --input-dir."
MB-Chat\scripts\data_pipeline.py:560:        print(f"✓ Balanced dataset size: {len(df_clean)}")
MB-Chat\scripts\data_pipeline.py:602:        'logs_count', 'metrics_count', 'has_data',
MB-Chat\scripts\data_pipeline.py:603:        'logs_count_normalized', 'metrics_count_normalized',
MB-Chat\scripts\data_pipeline.py:640:        # For small datasets, use 70/30 split and duplicate validation from test
MB-Chat\scripts\data_pipeline.py:645:        # Duplicate test as validation for small datasets
MB-Chat\scripts\data_pipeline.py:648:        print(f"\nSmall dataset ({n_samples} samples) - using 70/30 split with validation = test")
MB-Chat\scripts\data_pipeline.py:684:    # Save raw datasets
MB-Chat\scripts\data_pipeline.py:692:    # Save scaled datasets (for RF, need original; for NN/SVM need scaled)
MB-Chat\scripts\data_pipeline.py:711:        'dataset_type': dataset_type,
MB-Chat\scripts\data_pipeline.py:746:   ├─ Context: 5 (logs, metrics, severity)
MB-Chat\scripts\data_pipeline.py:762:    parser = argparse.ArgumentParser(description='Feature engineering pipeline for MetaBrain datasets')
MB-Chat\scripts\data_pipeline.py:763:    parser.add_argument('--input-dir', default='data/production_dataset', help='Input dataset directory')
MB-Chat\scripts\data_pipeline.py:764:    parser.add_argument('--output-dir', default='data/processed', help='Output processed directory')
MB-Chat\scripts\data_pipeline.py:766:        '--dataset-type',
MB-Chat\scripts\data_pipeline.py:773:    create_dataset(input_dir=args.input_dir, output_dir=args.output_dir, dataset_type=args.dataset_type)
MB-Chat\scripts\extract_real_dataset.py:107:        description='Split data into production and synthetic datasets using incident provenance heuristics.'
MB-Chat\scripts\extract_real_dataset.py:110:    parser.add_argument('--production-dir', default='data/production_dataset', help='Output directory for production dataset')
MB-Chat\scripts\extract_real_dataset.py:111:    parser.add_argument('--synthetic-dir', default='data/synthetic_dataset', help='Output directory for synthetic dataset')
MB-Chat\scripts\extract_real_dataset.py:135:    with (source_dir / 'dataset_split_summary.json').open('w', encoding='utf-8') as f:
MB-Chat\scripts\extract_real_dataset.py:141:    print(f"  Summary: {(source_dir / 'dataset_split_summary.json').resolve()}")
MB-Chat\services\api_gateway\main.py:270:    security.clear_security_settings_cache()
MB-Chat\scripts\feature_selection.py:74:        elif 'logs_count' in feat:
MB-Chat\scripts\feature_selection.py:261:    print("\nLoading datasets...")
MB-Chat\scripts\feature_selection.py:262:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\feature_selection.py:263:    X_test = pd.read_csv('data/processed/X_test.csv')
MB-Chat\scripts\feature_selection.py:264:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\scripts\feature_selection.py:265:    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()
MB-Chat\scripts\feature_selection.py:267:    with open('data/processed/feature_names.txt') as f:
MB-Chat\scripts\feature_selection.py:337:    print(f"\nRecommendations for dataset optimization:")
MB-Chat\scripts\feature_selection.py:348:    os.makedirs('data/processed', exist_ok=True)
MB-Chat\scripts\feature_selection.py:355:    X_train_opt.to_csv('data/processed/X_train_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:356:    X_test_opt.to_csv('data/processed/X_test_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:357:    y_train.to_csv('data/processed/y_train_optimized.csv', index=False) if hasattr(y_train, 'to_csv') else pd.Series(y_train).to_csv('data/processed/y_train_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:358:    y_test.to_csv('data/processed/y_test_optimized.csv', index=False) if hasattr(y_test, 'to_csv') else pd.Series(y_test).to_csv('data/processed/y_test_optimized.csv', index=False)
MB-Chat\scripts\feature_selection.py:360:    with open('data/processed/feature_names_optimized.txt', 'w') as f:
MB-Chat\scripts\feature_selection.py:375:    X_train_top80.to_csv('data/processed/X_train_top80_importance.csv', index=False)
MB-Chat\scripts\feature_selection.py:376:    X_test_top80.to_csv('data/processed/X_test_top80_importance.csv', index=False)
MB-Chat\scripts\feature_selection.py:378:    with open('data/processed/feature_names_top80_importance.txt', 'w') as f:
MB-Chat\models\v13\feature_names.txt:14:logs_count
MB-Chat\models\v13\feature_names.txt:17:logs_count_normalized
MB-Chat\scripts\generate_synthetic_data.py:97:def generate_synthetic_dataset(total_incidents: int, seed: int, noise_level: float) -> Dict[str, List[dict]]:
MB-Chat\scripts\generate_synthetic_data.py:155:            logs_count = max(0, int(random.gauss(5 if severity in ("low", "medium") else 9, 2)))
MB-Chat\scripts\generate_synthetic_data.py:172:                        "logs": [f"{severity.upper()} signal {i}" for i in range(logs_count)],
MB-Chat\scripts\generate_synthetic_data.py:260:    dataset = generate_synthetic_dataset(total_incidents=args.count, seed=args.seed, noise_level=args.noise)
MB-Chat\scripts\generate_synthetic_data.py:263:    write_json(data_dir / "incidents.json", dataset["incidents"])
MB-Chat\scripts\generate_synthetic_data.py:264:    write_json(data_dir / "outcomes.json", dataset["outcomes"])
MB-Chat\scripts\generate_synthetic_data.py:265:    write_json(data_dir / "audit.json", dataset["audits"])
MB-Chat\scripts\generate_synthetic_data.py:267:    print("Synthetic dataset generated successfully")
MB-Chat\scripts\generate_synthetic_data.py:268:    print(f"  Incidents: {len(dataset['incidents'])}")
MB-Chat\scripts\generate_synthetic_data.py:269:    print(f"  Outcomes:  {len(dataset['outcomes'])}")
MB-Chat\scripts\generate_synthetic_data.py:270:    print(f"  Audits:    {len(dataset['audits'])}")
MB-Chat\scripts\generate_synthetic_data.py:271:    print(f"  Distribution by action: {dataset['class_distribution']}")
MB-Chat\models\v13\metrics.json:50:    "logs_count",
MB-Chat\models\v13\metrics.json:53:    "logs_count_normalized",
MB-Chat\models\v14\feature_names.txt:14:logs_count
MB-Chat\models\v14\feature_names.txt:17:logs_count_normalized
MB-Chat\models\v14\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v14\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v14\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v14\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\models\v14\metrics.json:50:    "logs_count",
MB-Chat\models\v14\metrics.json:53:    "logs_count_normalized",
MB-Chat\models\v13\onnx_metadata.json:23:    "logs_count",
MB-Chat\models\v13\onnx_metadata.json:26:    "logs_count_normalized",
MB-Chat\models\v13\onnx_metadata.json:62:    "logs_count": 7.0,
MB-Chat\models\v13\onnx_metadata.json:65:    "logs_count_normalized": 0.14,
MB-Chat\memory\README.md:20:- Prepare future pgvector or Qdrant integration without adding dependencies.
MB-Chat\memory\README.md:35:- No external embedding provider is called.
MB-Chat\memory\types.ts:110:  vectorEnabled: boolean;
MB-Chat\memory\types.ts:141:  retrieval_mode: "disabled" | "lexical_jsonl" | "future_vector";
MB-Chat\memory\vector-backend.contract.ts:4:  embedding: number[];
MB-Chat\memory\vector-backend.contract.ts:13:  backend: "pgvector" | "qdrant" | "local_vector" | "future_provider";
MB-Chat\memory\vector-backend.contract.ts:17:  upsert_vector(entry: MemoryEntry, embedding: number[]): Promise<void>;
MB-Chat\memory\vector-backend.contract.ts:18:  vector_search(input: VectorSearchInput): Promise<VectorSearchResult[]>;
MB-Chat\memory\vector-backend.contract.ts:24:  allowedFutureBackends: ["pgvector", "qdrant", "local_vector"],
MB-Chat\memory\vector-backend.contract.ts:25:  note: "Contract only. No vector database dependency or runtime activation is introduced in Phase 3.",
MB-Chat\scripts\run_ml_validation.py:145:    # Step 1: Split production vs synthetic dataset
MB-Chat\scripts\run_ml_validation.py:150:        [python_exe, "scripts/extract_real_dataset.py"]
MB-Chat\scripts\run_ml_validation.py:164:            "data/production_dataset",
MB-Chat\scripts\run_ml_validation.py:166:            "data/processed",
MB-Chat\scripts\run_ml_validation.py:167:            "--dataset-type",
MB-Chat\scripts\traffic_shadow_real_check.py:11:PROCESSED_DIR = ROOT / "data" / "processed"
MB-Chat\scripts\train_model_incremental.py:40:from model_registry import ModelRegistry
MB-Chat\scripts\train_model_incremental.py:44:    """Load the historical training dataset"""
MB-Chat\scripts\train_model_incremental.py:45:    X_train_path = Path('data/processed/X_train.csv')
MB-Chat\scripts\train_model_incremental.py:46:    y_train_path = Path('data/processed/y_train.csv')
MB-Chat\scripts\train_model_incremental.py:47:    X_test_path = Path('data/processed/X_test.csv')
MB-Chat\scripts\train_model_incremental.py:48:    y_test_path = Path('data/processed/y_test.csv')
MB-Chat\scripts\train_model_incremental.py:77:def combine_datasets(X_train, y_train, X_incremental, y_incremental):
MB-Chat\scripts\train_model_incremental.py:78:    """Combine historical and incremental datasets"""
MB-Chat\scripts\train_model_incremental.py:87:    print(f'[OnlineLearning] Combined dataset: {len(X_combined)} records, {len(X_combined.columns)} features')
MB-Chat\scripts\train_model_incremental.py:148:        X_combined, y_combined, feature_names = combine_datasets(
MB-Chat\scripts\train_model_incremental.py:188:        X_test_path='data/processed/X_test.csv',
MB-Chat\scripts\train_model_incremental.py:218:    # Step 5: Export artifacts
MB-Chat\scripts\train_model.py:25:from model_registry import ModelRegistry
MB-Chat\scripts\train_model.py:280:def load_processed_metadata():
MB-Chat\scripts\train_model.py:281:    metadata_path = 'data/processed/metadata.json'
MB-Chat\scripts\train_model.py:291:def enforce_dataset_gate(y_train, y_val, y_test):
MB-Chat\scripts\train_model.py:292:    metadata = load_processed_metadata()
MB-Chat\scripts\train_model.py:293:    dataset_type = str(metadata.get('dataset_type', 'unknown')).lower()
MB-Chat\scripts\train_model.py:295:    if dataset_type != 'production':
MB-Chat\scripts\train_model.py:296:        print(f"Dataset type: {dataset_type} (production gate not enforced)")
MB-Chat\scripts\train_model.py:313:            "Production dataset gate failed: "
MB-Chat\scripts\train_model.py:357:    X_test_path: str = 'data/processed/X_test.csv',
MB-Chat\scripts\train_model.py:470:    feature_names_path = 'data/processed/feature_names.txt'
MB-Chat\scripts\train_model.py:472:    action_mapping_path = 'data/processed/action_mapping.txt'
MB-Chat\scripts\train_model.py:476:    processed_metadata = load_processed_metadata()
MB-Chat\scripts\train_model.py:522:        or processed_metadata.get('pipeline_version')
MB-Chat\scripts\train_model.py:565:    X_train = pd.read_csv('data/processed/X_train.csv')
MB-Chat\scripts\train_model.py:566:    y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()
MB-Chat\scripts\train_model.py:567:    X_val = pd.read_csv('data/processed/X_val.csv')
MB-Chat\scripts\train_model.py:568:    y_val = pd.read_csv('data/processed/y_val.csv').values.ravel()
MB-Chat\scripts\train_model.py:569:    X_test = pd.read_csv('data/processed/X_test.csv')
MB-Chat\scripts\train_model.py:570:    y_test = pd.read_csv('data/processed/y_test.csv').values.ravel()
MB-Chat\scripts\train_model.py:572:    enforce_dataset_gate(y_train, y_val, y_test)
MB-Chat\scripts\train_model.py:652:        # Stratified K-Fold for imbalanced datasets
MB-Chat\scripts\visualize_features.py:98:        'Behavioral Flags': ['escalation', 'retry_count', 'last_action', 'logs', 'metrics'],
MB-Chat\scripts\validate_onnx_parity.py:10:    X_test = pd.read_csv('data/processed/X_test.csv')

```
## Migration sequence (reversible)
```
1. Create canonical runtime tree under E:\GSentinelRuntime (directories only, reversible).
2. Snapshot current paths and checksums for files to migrate (copy-first strategy).
3. Copy runtime data/artifacts/uploads/logs/cache to canonical targets (no delete).
4. Keep source paths intact; switch Docker mounts/env to new targets in a second step.
5. Validate runtime health and content parity before any old-path retirement.
6. Rollback by restoring previous mount paths in compose and ignoring new tree.

```
