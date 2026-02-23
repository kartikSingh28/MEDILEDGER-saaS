import express from "express";
import cors from "cors";
import "dotenv/config";

import userRouter from "./routes/userRoute";
import recordRouter from "../src/routes/record.routes";

const app = express();

app.use(express.json());

app.use(cors({
  origin: "http://localhost:5173",
}));

app.get("/", (_req, res) => {
  res.send(" MediLedger Backend Running");
});


app.use("/auth", userRouter);
app.use("/records",recordRouter);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
