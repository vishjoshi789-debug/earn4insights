'use server'

import { createUser } from "@/lib/user/userStore"
import { z } from "zod"
import { PASSWORD_SPECIAL_CHARS_REGEX } from "@/lib/auth/passwordPolicy"

// Validation schemas
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must have: at least 8 characters")
    .regex(/[A-Z]/, "Password must have: one uppercase letter")
    .regex(/[a-z]/, "Password must have: one lowercase letter")
    .regex(/[0-9]/, "Password must have: one number")
    .regex(PASSWORD_SPECIAL_CHARS_REGEX, "Password must have: one special symbol (!@#$%^&*)"),
  // 3.5A — influencer is now a first-class signup role alongside
  // brand + consumer. Admin is still never self-assignable.
  role: z.enum(['brand', 'consumer', 'influencer']),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service" })
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy" })
  }),
})

/**
 * Sign up with email and password
 */
export async function signUpAction(formData: FormData) {
  // Validate input
  let validatedData
  try {
    const rawData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
      acceptedTerms: formData.get('acceptedTerms') === 'true',
      acceptedPrivacy: formData.get('acceptedPrivacy') === 'true',
    }
    validatedData = signupSchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }
    return { error: 'Invalid input' }
  }

  // Create user only — sign-in handled client-side
  try {
    await createUser(validatedData)
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to create account. Please try again.' }
  }
}
