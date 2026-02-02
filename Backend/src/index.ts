import express from "express";
import cors from "cors";
import "dotenv/config";

import userRouter from "./routes/userRoute";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send(" MediLedger Backend Running");
});


app.use("/user", userRouter);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
