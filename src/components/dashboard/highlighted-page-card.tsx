'use client'

import React from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import type { Page } from '@/domain/page'

type Props = {
  highlightedPage: Page | null
}

export function HighlightedPageCard({ highlightedPage }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Página acessada na busca</CardTitle>
        <CardDescription>Destaque visual da página tocada durante a busca.</CardDescription>
      </CardHeader>

      <CardContent>
        {!highlightedPage && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Faça uma busca para destacar a página acessada.
          </div>
        )}

        {highlightedPage && (
          <div className="rounded-xl border border-amber-500 bg-amber-500/10 p-4 text-sm">
            <div className="mb-2 font-semibold">Página {highlightedPage.pageNumber}</div>
            <div className="grid gap-1">
              {highlightedPage.records.slice(0, 12).map((record, idx) => (
                <div key={`${record}-${idx}`} className="rounded border bg-background px-2 py-1">
                  {record}
                </div>
              ))}
              {highlightedPage.records.length > 12 && (
                <div className="text-xs text-muted-foreground">
                  + {highlightedPage.records.length - 12} registros nesta página.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
