import asyncio, asyncpg
async def main():
    conn=await asyncpg.connect(user='urban_user',password='urban_password',host='localhost',port=5433,database='urban_intelligence')
    for email in ['admin1@example.com','admin@example.com','worker@example.com']:
        r=await conn.execute("UPDATE users SET is_verified=true, is_active=true WHERE email=$1", email)
        print(email, r)
    rows=await conn.fetch("SELECT email, is_verified, role FROM users")
    for r in rows:
        print(r)
    await conn.close()
asyncio.run(main())
