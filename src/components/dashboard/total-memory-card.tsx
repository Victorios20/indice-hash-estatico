'use client'

import React from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  totalWords: number
}

export function TotalMemoryCard({ totalWords }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Total em memória</CardTitle>
        <CardDescription>Quantidade de registros carregados para simular a tabela.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total de palavras</span>
            <span className="text-sm font-semibold">{totalWords}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
