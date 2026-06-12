import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { config } from "./config";
import { authRouter, requireAuth } from "./auth";
import { HttpError } from "./lib/helpers";
import {
  accountsRouter,
  groupsRouter,
  transactionsRouter,
} from "./domains/accounts";
import {
  allocationsByMonthRouter,
  allocationsRouter,
  categoriesRouter,
  draftsRouter,
  forecastRouter,
  spreadsheetRouter,
} from "./domains/misc";
import { expensesSearchRouter, monthsRouter } from "./domains/months";
import { savingsRouter } from "./domains/savings";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "budgetability-api" });
  });

  const v1 = express.Router();
  v1.use("/auth", authRouter);

  // Everything below requires a JWT access token or a PAT.
  v1.use(requireAuth);
  v1.use("/months", monthsRouter);
  v1.use("/months", allocationsByMonthRouter);
  v1.use("/allocations", allocationsRouter);
  v1.use("/expenses", expensesSearchRouter);
  v1.use("/drafts", draftsRouter);
  v1.use("/categories", categoriesRouter);
  v1.use("/accounts", accountsRouter);
  v1.use("/account-groups", groupsRouter);
  v1.use("/transactions", transactionsRouter);
  v1.use("/savings-goals", savingsRouter);
  v1.use("/forecast-flows", forecastRouter);
  v1.use("/spreadsheet-entries", spreadsheetRouter);

  app.use("/api/v1", v1);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
