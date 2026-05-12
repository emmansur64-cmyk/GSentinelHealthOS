FROM redis:8.0.2-alpine

COPY broker/redis.conf /usr/local/etc/redis/redis.conf

USER redis

CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
