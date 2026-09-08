import asyncio, asyncpg
async def t():
    conn=await asyncpg.connect(user='urban_user',password='urban_password',host='localhost',port=5433,database='urban_intelligence')
    rows=await conn.fetch('SELECT tablename FROM pg_tables WHERE schemaname=''public'' ORDER BY tablename')
    print([r[0] for r in rows])
    await conn.close()
asyncio.run(t())
