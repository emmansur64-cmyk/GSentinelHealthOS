import psycopg

dsn = "host=localhost port=5432 dbname=sentinel_health user=sentinel password=sentinel_password"
with psycopg.connect(dsn) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position")
        cols = [r[0] for r in cur.fetchall()]
        print('COLUMNS|' + ','.join(cols))
        if 'email' in cols:
            cur.execute("SELECT username, email, role, is_active FROM users WHERE username IN ('admin','doctor.demo') ORDER BY username")
            for r in cur.fetchall():
                print(f"USER|{r[0]}|{r[1]}|{r[2]}|{r[3]}")
        else:
            cur.execute("SELECT username, role, is_active FROM users WHERE username IN ('admin','doctor.demo') ORDER BY username")
            for r in cur.fetchall():
                print(f"USER|{r[0]}|{r[1]}|{r[2]}")
