'use client'

import React from 'react'
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; total: number; fileName: string }
  | { status: 'error'; message: string }

type Props = {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  loadState: LoadState
  isBusy: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  onReset: () => void
}

export function UploadCard({ fileInputRef, loadState, isBusy, onFileChange, onReset }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Carregar arquivo
        </CardTitle>
        <CardDescription>Selecione o words.txt (1 palavra por linha).</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wordsFile">Arquivo (.txt)</Label>
          <Input
            ref={fileInputRef}
            id="wordsFile"
            type="file"
            accept=".txt,text/plain"
            onChange={onFileChange}
            disabled={isBusy}
          />
          <p className="text-xs text-muted-foreground">
            O arquivo não fica no repositório. Você seleciona do seu computador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="rounded-xl"
          >
            {loadState.status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Selecionar'
            )}
          </Button>

          <Button type="button" variant="outline" onClick={onReset} className="rounded-xl" disabled={isBusy}>
            Limpar
          </Button>
        </div>

        {loadState.status === 'idle' && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nenhum arquivo carregado ainda.
          </div>
        )}

        {loadState.status === 'loading' && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">Carregando arquivo...</div>
        )}

        {loadState.status === 'success' && (
          <Alert className="rounded-xl">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Arquivo carregado</AlertTitle>
            <AlertDescription>
              <span className="font-medium">{loadState.fileName}</span> - total de palavras:{' '}
              <span className="font-semibold">{loadState.total}</span>
            </AlertDescription>
          </Alert>
        )}

        {loadState.status === 'error' && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar</AlertTitle>
            <AlertDescription>{loadState.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
