# APPLY RUNTIME ISOLATION DIFF
Generated: 2026-05-19 00:19:31 -03:00
## git diff -- docker-compose.yml
```
diff --git a/docker-compose.yml b/docker-compose.yml
index 049c6a6..03f9ca0 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -338,7 +338,7 @@ services:
       - "127.0.0.1:${BRAIN_PORT:-8001}:8001"
     volumes:
       - uploads_data:/data/uploads
-      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
+      - E:/GSentinelRuntime/artifacts/mb-chat-learning:/app/artifacts/mb-chat-learning:rw
     networks:
       - gs_prod
     restart: unless-stopped
@@ -466,7 +466,7 @@ services:
     networks:
       - gs_prod
     volumes:
-      - ./MB-Chat/data:/app/artifacts/mb-chat-learning
+      - E:/GSentinelRuntime/artifacts/mb-chat-learning:/app/artifacts/mb-chat-learning:rw
     restart: unless-stopped
     healthcheck:
       test: ["CMD-SHELL", "node -e \"fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
@@ -992,3 +992,4 @@ networks:
     driver: bridge
 
 
+

```
