import psycopg

dsn = "host=localhost port=5432 dbname=sentinel_health user=sentinel password=sentinel_password"
with psycopg.connect(dsn) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT username, role, is_active FROM users WHERE username IN ('admin','doctor.demo') ORDER BY username")
        rows = cur.fetchall()
        for r in rows:
            print(f"{r[0]}|{r[1]}|{r[2]}")
