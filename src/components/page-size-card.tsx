'use client'

import React, { useMemo } from 'react'
import { Layers, AlertCircle, Loader2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  canDivide: boolean
  onDivide: () => void
  isLoading?: boolean
}

export function PageSizeCard({ value, onChange, disabled, canDivide, onDivide, isLoading }: Props) {
  const parsed = useMemo(() => {
    if (value.trim().length === 0) return { ok: false, n: 0 } // vazio ? 
    const n = Number(value) //Transforma em um numero 
    if (!Number.isFinite(n)) return { ok: false, n: 0 } //NaN
    if (!Number.isInteger(n)) return { ok: false, n: 0 }// é Inteiro ?
    if (n <= 0) return { ok: false, n: 0 }
    return { ok: true, n }
  }, [value])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Tamanho da página
        </CardTitle>
        <CardDescription>Quantos registros (palavras) cabem em cada página.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pageSize">Registros por página</Label>
          <Input
            id="pageSize"
            type="number"
            inputMode="numeric"
            placeholder="Ex: 100"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            min={1}
          />
          <p className="text-xs text-muted-foreground">Use um número inteiro maior que zero.</p>
        </div>

        {!parsed.ok && value.trim().length > 0 && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Valor inválido</AlertTitle>
            <AlertDescription>Digite um número inteiro maior que zero.</AlertDescription>
          </Alert>
        )}

        <Button type="button" className="w-full rounded-xl" disabled={!canDivide || isLoading} onClick={onDivide}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Dividindo...
            </>
          ) : (
            'Dividir em páginas'
          )}
        </Button>

        {!canDivide && (
          <p className="text-xs text-muted-foreground">
            Para dividir: carregue o arquivo e informe um tamanho de página válido.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
