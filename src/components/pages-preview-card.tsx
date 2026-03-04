'use client'

import React from 'react'
import { FileText } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  totalPages: number
  firstPage?: { pageNumber: number; preview: string[] }
  lastPage?: { pageNumber: number; preview: string[] }
}

export function PagesPreviewCard({ totalPages, firstPage, lastPage }: Props) {
  const renderPage = (label: string, page?: { pageNumber: number; preview: string[] }) => {
    if (!page) {
      return (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          {label}: ainda não gerada.
        </div>
      )
    }

    return (
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">Página {page.pageNumber}</span>
        </div>

        <div className="mt-3 space-y-1 text-sm">
          {page.preview.map((w, idx) => (
            <div key={`${label}-${w}-${idx}`} className="rounded-lg border bg-background px-3 py-2">
              {w}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Páginas
        </CardTitle>
        <CardDescription>Total calculado + prévia da primeira e última página (5 registros).</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total de páginas</span>
            <span className="text-sm font-semibold">{totalPages}</span>
          </div>
        </div>

        {renderPage('Primeira página', firstPage)}
        {renderPage('Última página', lastPage)}
      </CardContent>
    </Card>
  )
}