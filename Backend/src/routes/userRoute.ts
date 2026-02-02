import { Router } from "express";
import { signupSchema, signinSchema } from "../Schemas/AuthSchema";
import { signup, signin } from "../Auth/Auth";

const userRouter = Router();
userRouter.get("/", (_req, res) => {
  res.send("Auth routes running ");
});
userRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const user = await signup(parsed.data);
    res.status(201).json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


userRouter.post("/signin", async (req, res) => {
  const parsed = signinSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const result = await signin(parsed.data);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

export default userRouter;
