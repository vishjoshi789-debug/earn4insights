'use server'

import { signIn } from "@/lib/auth/auth.config"
import { createUser } from "@/lib/user/userStore"
import type { CreateUserInput } from "@/lib/user/types"
import { redirect } from "next/navigation"
import { z } from "zod"
import { AuthError, CredentialsSignin } from "next-auth"

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

  // Create user
  let user
  try {
    user = await createUser(validatedData)
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to create account. Please try again.' }
  }

  // Sign in the newly created user
  try {
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Account created but sign-in failed. Please sign in manually.' }
    }
    throw error
  }
  
  // Redirect after successful sign-in (outside try-catch so NEXT_REDIRECT propagates)
  const redirectUrl = user.role === 'brand' ? '/dashboard' : '/top-products'
  redirect(redirectUrl)
}

/**
 * Sign in with email and password
 */
export async function signInAction(formData: FormData) {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  // Validate input
  let validatedData
  try {
    validatedData = loginSchema.parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }
    return { error: 'Invalid input' }
  }

  try {
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: 'Invalid email or password' }
    }
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password' }
    }
    // Re-throw unexpected errors
    throw error
  }
  
  // Redirect after successful sign-in (outside try-catch so NEXT_REDIRECT propagates)
  redirect("/dashboard")
}

/**
 * Sign in with Google
 */
export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/dashboard" })
}
