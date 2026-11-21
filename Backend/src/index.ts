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

app.use(cors({
  origin: "http://localhost:5173",
}));

app.get("/", (_req, res) => {
  res.send("MediLedger Backend Running");
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

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});