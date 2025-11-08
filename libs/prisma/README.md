# Prisma Cheatsheet

# 1. Initialize Prisma (creates prisma/schema.prisma)

npx prisma init

# 2. Generate client (updates node_modules/@prisma/client)

npx prisma generate

# 3. Create a migration and apply to the database

# Use when the schema changes

npx prisma migrate dev --name <migration_name>

# 4. Apply all migrations without creating new ones

# Handy for deploy/CI

npx prisma migrate deploy

# 5. Push schema changes directly without migrations

# ⚠️ Use only during early development

npx prisma db push

# 6. Reset database and reapply migrations

# Useful during prototyping

npx prisma migrate reset

# 7. Open Prisma Studio (data GUI)

npx prisma studio

# 8. Validate schema for errors

npx prisma validate

# 9. Inspect migration status

npx prisma migrate status

# 10. Format schema.prisma

npx prisma format
