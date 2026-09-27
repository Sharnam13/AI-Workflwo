import { z } from "zod";

export const createOrderSchema = z.object({
  email: z.email().max(254),
  customerName: z.string().trim().min(1).max(100),
  paymentType: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(["COD", "PREPAID"])),
  orderValue: z.coerce.number().positive().max(10_000_000),
  address: z.string().trim().min(5).max(500),
  pincode: z.coerce
    .string()
    .trim()
    .regex(/^\d{6}$/, "pincode must be 6 digits"),
  items: z.array(z.string().max(200)).max(100).default([]),
});

export const updateStatusSchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED", "RTO", "FAILED", "CANCELLED"]),
});
