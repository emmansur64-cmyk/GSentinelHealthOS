import asyncio
import os
import sys
from uuid import uuid4
from passlib.context import CryptContext
from api.app.db.session import async_session_local
from sqlalchemy import text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_seed_users():
    admin_password = os.environ.get("SEED_ADMIN_PASSWORD")
    doctor_password = os.environ.get("SEED_DOCTOR_PASSWORD")

    if not admin_password or not doctor_password:
        print("ERROR: SEED_ADMIN_PASSWORD y SEED_DOCTOR_PASSWORD deben estar definidos en variables de entorno.")
        sys.exit(1)
    
    admin_hash = pwd_context.hash(admin_password)
    doctor_hash = pwd_context.hash(doctor_password)
    
    async with async_session_local() as session:
        await session.execute(text("""
            INSERT INTO users (id, username, email, hashed_password, role, is_active)
            VALUES (:id, :username, :email, :hashed_password, :role, :is_active)
            ON CONFLICT (username) DO UPDATE SET
                email = EXCLUDED.email,
                hashed_password = EXCLUDED.hashed_password,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
        """), {
            "id": str(uuid4()),
            "username": "admin",
            "email": "admin@example.com",
            "hashed_password": admin_hash,
            "role": "admin",
            "is_active": True
        })
        
        await session.execute(text("""
            INSERT INTO users (id, username, email, hashed_password, role, is_active)
            VALUES (:id, :username, :email, :hashed_password, :role, :is_active)
            ON CONFLICT (username) DO UPDATE SET
                email = EXCLUDED.email,
                hashed_password = EXCLUDED.hashed_password,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active,
                updated_at = CURRENT_TIMESTAMP
        """), {
            "id": str(uuid4()),
            "username": "doctor.demo",
            "email": "doctor@example.com",
            "hashed_password": doctor_hash,
            "role": "doctor",
            "is_active": True
        })
        
        await session.commit()
    
    print("✓ Seed users created successfully")

asyncio.run(create_seed_users())
