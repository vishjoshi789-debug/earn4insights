'use server'

import { signIn } from "@/lib/auth/auth.config"
import { createUser } from "@/lib/user/userStore"
import type { CreateUserInput } from "@/lib/user/types"
import { redirect } from "next/navigation"
import { z } from "zod"

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

    // Sign in the user
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    })

    // Return success - let the client handle redirect
    return {
      success: true,
      redirectUrl: user.role === 'brand' ? '/dashboard' : '/top-products'
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0].message
      }
    }
    
    if (error instanceof Error) {
      return {
        error: error.message
      }
    }
    
    return {
      error: 'Failed to create account. Please try again.'
    }
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

    // Attempt sign in
    const result = await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    })

    if (!result) {
      return { error: 'Invalid email or password' }
    }

    // Success - will redirect in component
    return { success: true }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: error.errors[0].message
      }
    }
    
    return {
      error: 'Invalid email or password'
    }
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/dashboard" })
}
