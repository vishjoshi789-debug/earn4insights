'use server'

import { signIn } from "@/lib/auth/auth.config"
import { createUser } from "@/lib/user/userStore"
import type { CreateUserInput } from "@/lib/user/types"
import { redirect } from "next/navigation"
import { z } from "zod"
import { AuthError } from "next-auth"

// Validation schemas
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(['brand', 'consumer']),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service" })
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy" })
  }),
})

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

/**
 * Sign up with email and password
 */
export async function signUpAction(formData: FormData) {
  try {
    const rawData = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
      acceptedTerms: formData.get('acceptedTerms') === 'true',
      acceptedPrivacy: formData.get('acceptedPrivacy') === 'true',
    }

    // Validate input
    const validatedData = signupSchema.parse(rawData)

    // Create user
    const user = await createUser(validatedData)

    // Sign in the user — NextAuth v5 redirectTo for server actions
    const redirectUrl = user.role === 'brand' ? '/dashboard' : '/top-products'
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirectTo: redirectUrl,
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0].message
      }
    }
    
    if (error instanceof AuthError) {
      return {
        error: 'Failed to create account. Please try again.'
      }
    }
    
    if (error instanceof Error && !error.message.includes('NEXT_REDIRECT')) {
      return {
        error: error.message
      }
    }
    
    // Re-throw NEXT_REDIRECT and other non-auth errors
    throw error
  }
}

/**
 * Sign in with email and password
 */
export async function signInAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get('email'),
      password: formData.get('password'),
    }

    // Validate input
    const validatedData = loginSchema.parse(rawData)

    // NextAuth v5: use redirectTo so NEXT_REDIRECT propagates correctly
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirectTo: "/dashboard",
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0].message
      }
    }
    
    if (error instanceof AuthError) {
      return {
        error: 'Invalid email or password'
      }
    }
    
    // Re-throw non-auth errors (NEXT_REDIRECT must propagate)
    throw error
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/dashboard" })
}
