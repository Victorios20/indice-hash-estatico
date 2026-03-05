'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, CircleAlert, X } from 'lucide-react'

export type DashboardToastType = 'success' | 'error' | 'warning'

export type DashboardToast = {
  id: number
  type: DashboardToastType
  title: string
  description: string
}

type Props = {
  toasts: DashboardToast[]
  onDismiss: (id: number) => void
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[360px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border p-3 shadow-sm backdrop-blur ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : toast.type === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4" />}
              {toast.type === 'warning' && <CircleAlert className="mt-0.5 h-4 w-4" />}
              {toast.type === 'error' && <AlertCircle className="mt-0.5 h-4 w-4" />}
              <div>
                <div className="text-sm font-semibold">{toast.title}</div>
                <div className="text-xs text-muted-foreground">{toast.description}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-1 hover:bg-black/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
