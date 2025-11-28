"use client"

import * as React from "react"

const TOAST_LIMIT = 1 // Standard limit for simultaneous toasts
const TOAST_REMOVE_DELAY = 1000000 // Standard delay (can be customized)

type TToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive"
  open?: boolean // Added for explicit open/close state tracking
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: TToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<TToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: TToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: TToast["id"]
    }

interface State {
  toasts: TToast[]
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST":
      const { toastId } = action
      if (toastId) {
        return {
          ...state,
          toasts: state.toasts.map((t) =>
            t.id === toastId ? { ...t, open: false } : t
          ),
        }
      }
      return {
        ...state,
        toasts: state.toasts.map((t) => ({ ...t, open: false })),
      }

    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
      
    default:
        return state;
  }
}

const ToastContext = React.createContext<
  | ({
      toast: ({ ...props }: Omit<TToast, "id">) => {
        id: string
        dismiss: () => void
        update: (props: Partial<TToast>) => void
      }
    } & State)
  | undefined
>(undefined)

// 1. EXPORT THE HOOK (Named Export)
export function useToast() {
  const context = React.useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}

type ToastProviderProps = {
  children: React.ReactNode
}

// 2. EXPORT THE PROVIDER (Named Export)
export function ToastProvider({ children }: ToastProviderProps) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] })

  React.useEffect(() => {
    state.toasts.forEach((toast) => {
      // Logic to auto-remove toast after a delay
      const removeTimer = setTimeout(() => {
        // Ensure we only remove toasts that are not being interacted with
        if (toast.open !== false) {
             dispatch({ type: "REMOVE_TOAST", toastId: toast.id })
        }
      }, TOAST_REMOVE_DELAY)

      return () => clearTimeout(removeTimer)
    })
  }, [state.toasts])

  const addToast = React.useCallback(
    ({ ...props }: Omit<TToast, "id">) => {
      const id = genId()

      const update = (props: Partial<TToast>) =>
        dispatch({ type: "UPDATE_TOAST", toast: { id, ...props } })
      const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

      dispatch({
        type: "ADD_TOAST",
        toast: {
          ...props,
          id,
          title: props.title,
          description: props.description,
          action: props.action,
          variant: props.variant,
          open: true,
        } as TToast,
      })

      return {
        id: id,
        dismiss,
        update,
      }
    },
    [dispatch]
  )

  const contextValue = React.useMemo(
    () => ({
      ...state,
      toast: addToast,
    }),
    [state, addToast]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  )
}