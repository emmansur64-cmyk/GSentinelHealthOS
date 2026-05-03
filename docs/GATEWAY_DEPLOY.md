# WhatsApp Gateway Deploy

Desde ahora el WhatsApp Gateway se despliega solo con:

```bash
./scripts/deploy-gateway-safe.sh
```

No usar para gateway:

```bash
docker-compose up -d --build gateway
```

Ese comando puede intentar levantar dependencias y duplicar Redis en producción.
