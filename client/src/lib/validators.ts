import { z } from "zod";

// Login form validation schema
export const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Password validation schema with requirements
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .refine(
    (password) => /[0-9]/.test(password),
    { message: "Password must contain at least 1 number" }
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    { message: "Password must contain at least 1 special character" }
  );

// Sign-up form validation schema
export const signupSchema = z
  .object({
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
    businessName: z.string().min(1, { message: "Business name is required" }),
    phoneNumber: z
      .string()
      .min(1, { message: "Phone number is required" })
      .refine(
        (phone) => /^(\+\d{1,3})?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(phone),
        { message: "Please enter a valid phone number" }
      ),
    website: z.string().optional().or(z.literal("")),
    servicePlan: z.enum(["inbound", "outbound", "both"], {
      required_error: "Please select a service plan",
    }),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;

// Forgot password validation schema
export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
