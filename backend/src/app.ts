import dotenv from "dotenv";
import express, { type Express, type Request, type Response } from "express";

dotenv.config();

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "collabtasks-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Bem-vindo à API collabtasks",
  });
});

export default app;
