import app from "./app.js";
import { prisma } from "./shared/database/prisma.js";

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  await prisma.$connect();
  app.listen(port, () => {
    console.log(`servidor rodando na porta http://localhost:${port}`);
  });
}

startServer().catch(async (error: unknown) => {
  console.error("Não foi possível conectar ao PostgreSQL:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
