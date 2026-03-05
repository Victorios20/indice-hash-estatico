'use client'

import React from 'react'
import { Hash } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { HashFunctionName } from '@/domain/hash-index'

type Props = {
  hashFunction: HashFunctionName
  onChangeHashFunction: (next: HashFunctionName) => void
  sampleKey: string
  onChangeSampleKey: (next: string) => void
  sampleBucket: number | null
  nb: number
  isBusy: boolean
}

export function HashFunctionCard({
  hashFunction,
  onChangeHashFunction,
  sampleKey,
  onChangeSampleKey,
  sampleBucket,
  nb,
  isBusy,
}: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Configuração da função hash
        </CardTitle>
        <CardDescription>Escolha a função para mapear chave em bucket.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hashFunction">Função hash</Label>
            <select
              id="hashFunction"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={hashFunction}
              onChange={(e) => onChangeHashFunction(e.target.value as HashFunctionName)}
              disabled={isBusy}
            >
              <option value="djb2">djb2 (recomendada)</option>
              <option value="charCodeSum">charCodeSum (simples)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sampleKey">Chave de teste</Label>
            <Input
              id="sampleKey"
              value={sampleKey}
              onChange={(e) => onChangeSampleKey(e.target.value)}
              placeholder="Ex: banana"
              disabled={isBusy}
            />
          </div>
        </div>

        <div className="rounded-xl border p-4 text-sm">
          {sampleBucket === null ? (
            <span className="text-muted-foreground">Informe uma chave para visualizar o bucket calculado.</span>
          ) : (
            <span>
              Bucket calculado: <span className="font-semibold">{sampleBucket}</span> (intervalo válido: 0..
              {Math.max(nb - 1, 0)}).
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
