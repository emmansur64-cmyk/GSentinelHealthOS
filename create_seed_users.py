import asyncio
from passlib.context import CryptContext
from api.app.db.session import async_session_local
from sqlalchemy import text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_seed_users():
    admin_password = "Admin123!"
    doctor_password = "Doctor123!"
    
    admin_hash = pwd_context.hash(admin_password)
    doctor_hash = pwd_context.hash(doctor_password)
    
    print(f"Admin hash: {admin_hash}")
    print(f"Doctor hash: {doctor_hash}")
    
    async with async_session_local() as session:
        await session.execute(text("""
            INSERT INTO users (username, email, hashed_password, role, is_active)
            VALUES (:username, :email, :hashed_password, :role, :is_active)
            ON CONFLICT (username) DO NOTHING
        """), {
            "username": "admin",
            "email": "admin@example.com",
            "hashed_password": admin_hash,
            "role": "admin",
            "is_active": True
        })
        
        await session.execute(text("""
            INSERT INTO users (username, email, hashed_password, role, is_active)
            VALUES (:username, :email, :hashed_password, :role, :is_active)
            ON CONFLICT (username) DO NOTHING
        """), {
            "username": "doctor.demo",
            "email": "doctor@example.com",
            "hashed_password": doctor_hash,
            "role": "doctor",
            "is_active": True
        })
        
        await session.flush()
    
    print("✓ Seed users created successfully")

asyncio.run(create_seed_users())
