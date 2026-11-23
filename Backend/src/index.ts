import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import cors from "cors";
import "dotenv/config";

import userRouter from "./routes/userRoute";
import recordRouter from "./routes/record.routes";
import permissionRouter from "./routes/permission.routes";
import hospitalRouter from "./routes/hospital.routes";

const app = express(); // ✅ FIRST create app

app.use(express.json());

// Comma-separated list, so a deployment can allow its own origin without a
// code change. Defaults to the Vite dev server for local work.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    // Requests with no Origin header (curl, health checks, same-origin) are allowed through
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  })
);

app.get("/", (_req, res) => {
  res.send("MediLedger Backend Running");
});

// Unauthenticated liveness probe for load balancers and container health checks
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});


app.use("/auth", userRouter);
app.use("/records", recordRouter);
app.use("/permissions", permissionRouter);
app.use("/hospitals", hospitalRouter);

// Errors thrown outside route try/catch blocks (e.g. multer's file size limit)
// would otherwise reach Express's default handler, which replies with HTML.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File is larger than the 10 MB limit" });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Hosts that assign a port inject it as PORT; 5000 is the local default.
const PORT = Number(process.env.PORT) || 5000;

// Bind on all interfaces so the process is reachable from outside its container
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});