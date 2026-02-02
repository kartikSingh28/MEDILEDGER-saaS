import {z} from "zod";

export const signupSchema=z.object({
    email:z.string().email(),
    name:z.string().min(2).max(50).trim(),
    password:z.string().min(6).max(100),
    role: z.enum(["PATIENT", "DOCTOR", "ADMIN"])

});

export const signinSchema=z.object({
    email:z.string().email(),
    password:z.string().min(5).max(100),
});

export type SignUpInput=z.infer<typeof signupSchema>;
export type SignInInput=z.infer<typeof signinSchema>;
