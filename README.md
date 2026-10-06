# collabtasks

## Backend local

O backend usa Prisma 6 com PostgreSQL. Requer Node.js/npm e Docker com Docker Compose.

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run db:up
npm run db:migrate -- --name init
npm run build
npm run dev
```

O PostgreSQL fica disponível em `localhost:5432`. A base de dados local usa as
credenciais de desenvolvimento definidas no `docker-compose.yml`; não as reutilize
em produção. Para abrir o Prisma Studio, execute `npm run db:studio`. Para parar o
PostgreSQL sem remover os dados, execute `npm run db:down`.
