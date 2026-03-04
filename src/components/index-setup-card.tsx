'use client'

import React, { useMemo } from 'react'
import { Boxes, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = {
  frValue: string
  onChangeFR: (next: string) => void
  nr: number
  nb: number
  ruleOk: boolean
  disabled?: boolean
  canCreate: boolean
  onCreate: () => void
  created?: { fr: number; nb: number }
}

export function IndexSetupCard({
  frValue,
  onChangeFR,
  nr,
  nb,
  ruleOk,
  disabled,
  canCreate,
  onCreate,
  created,
}: Props) {
  const frParsed = useMemo(() => {
    const raw = frValue.trim()
    if (raw.length === 0) return { ok: false, n: 0 }
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, n: 0 }
    if (!Number.isInteger(n)) return { ok: false, n: 0 }
    if (n <= 0) return { ok: false, n: 0 }
    return { ok: true, n }
  }, [frValue])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          Índice Hash
        </CardTitle>
        <CardDescription>Defina FR e crie os buckets (NB é calculado automaticamente).</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fr">FR (capacidade do bucket)</Label>
          <Input
            id="fr"
            type="number"
            inputMode="numeric"
            placeholder="Ex: 4"
            value={frValue}
            onChange={(e) => onChangeFR(e.target.value)}
            disabled={disabled}
            min={1}
          />
        </div>

        {!frParsed.ok && frValue.trim().length > 0 && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>FR inválido</AlertTitle>
            <AlertDescription>Digite um número inteiro maior que zero.</AlertDescription>
          </Alert>
        )}

        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">NR (registros)</span>
            <span className="text-sm font-semibold">{nr}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">NB (buckets)</span>
            <span className="text-sm font-semibold">{nb}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Regra NB &gt; NR/FR</span>
            <span className={`text-sm font-semibold ${ruleOk ? '' : 'text-destructive'}`}>
              {ruleOk ? 'OK' : 'Inválida'}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            A regra garante espaço no índice e reduz colisões por bucket cheio.
          </p>
        </div>

        <Button type="button" className="w-full rounded-xl" disabled={!canCreate} onClick={onCreate}>
          Criar buckets
        </Button>

        {!canCreate && (
          <p className="text-xs text-muted-foreground">
            Para criar: carregue o arquivo, divida em páginas e informe um FR válido.
          </p>
        )}

        {created && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            Índice criado com <span className="font-semibold">FR={created.fr}</span> e{' '}
            <span className="font-semibold">NB={created.nb}</span>.
          </div>
        )}
      </CardContent>
    </Card>
  )
}