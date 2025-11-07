# prisma

# 1. Инициализация Prisma (создаёт prisma/schema.prisma)

npx prisma init

# 2. Генерация клиента (обновляет node_modules/@prisma/client)

npx prisma generate

# 3. Создание миграции и применение в базе

# Используй при изменении схемы

npx prisma migrate dev --name <migration_name>

# 4. Применить все миграции без создания новых

# Удобно при деплое или на CI

npx prisma migrate deploy

# 5. Применить изменения схемы напрямую в базу без миграции

# ⚠️ Используется только на ранних этапах разработки

npx prisma db push

# 6. Очистить базу и заново применить миграции

# Полезно при изменении структуры на этапе прототипа

npx prisma migrate reset

# 7. Открыть Prisma Studio (GUI для данных)

npx prisma studio

# 8. Проверить схему на ошибки

npx prisma validate

# 9. Посмотреть состояние миграций

npx prisma migrate status

# 10. Форматировать schema.prisma

npx prisma format
