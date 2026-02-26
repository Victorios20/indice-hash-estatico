'use client'

import React, { useMemo, useRef, useState } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ThemeToggle } from '@/components/theme-toggle'
import { PageSizeCard } from '@/components/page-size-card'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; total: number; fileName: string }
  | { status: 'error'; message: string }

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' })
  const [words, setWords] = useState<string[]>([])
  const [pageSize, setPageSize] = useState<string>('')

  const totalWords = useMemo(() => words.length, [words])

  const pageSizeValidation = useMemo(() => {
    const raw = pageSize.trim()
    if (raw.length === 0) return { ok: false, n: 0 }
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, n: 0 }
    if (!Number.isInteger(n)) return { ok: false, n: 0 }
    if (n <= 0) return { ok: false, n: 0 }
    return { ok: true, n }
  }, [pageSize])

  const canProceedToHU03 =
    loadState.status === 'success' && totalWords > 0 && pageSizeValidation.ok

  const reset = () => {
    setWords([])
    setLoadState({ status: 'idle' })
    setPageSize('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readTxtFile = async (file: File) => {
    setLoadState({ status: 'loading' })

    try {
      if (!file.name.toLowerCase().endsWith('.txt')) {
        setWords([])
        setLoadState({ status: 'error', message: 'Selecione um arquivo .txt' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const text = await file.text()

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (lines.length === 0) {
        setWords([])
        setLoadState({ status: 'error', message: 'O arquivo está vazio.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setWords(lines)
      setLoadState({ status: 'success', total: lines.length, fileName: file.name })
    } catch {
      setWords([])
      setLoadState({ status: 'error', message: 'Não foi possível ler o arquivo.' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await readTxtFile(file)
  }

  const handleDividePreview = () => {
    if (!canProceedToHU03) return
    alert(`HU03 vem agora 😄\nTamanho da página: ${pageSizeValidation.n}\nTotal de palavras: ${totalWords}`)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Índice Hash Estático</h1>
            <p className="text-muted-foreground">
              HU01 — Carregar TXT | HU02 — Definir tamanho da página
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Carregar arquivo
              </CardTitle>
              <CardDescription>
                Selecione o <span className="font-medium">words.txt</span> (1 palavra por linha).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wordsFile">Arquivo (.txt)</Label>
                <Input
                  ref={fileInputRef}
                  id="wordsFile"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  O arquivo não fica no repositório. Você seleciona do seu computador.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loadState.status === 'loading'}
                  className="rounded-xl"
                >
                  Selecionar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={reset}
                  className="rounded-xl"
                >
                  Limpar
                </Button>
              </div>

              {loadState.status === 'idle' && (
                <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Nenhum arquivo carregado ainda.
                </div>
              )}

              {loadState.status === 'loading' && (
                <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                  Carregando arquivo...
                </div>
              )}

              {loadState.status === 'success' && (
                <Alert className="rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Arquivo carregado</AlertTitle>
                  <AlertDescription>
                    <span className="font-medium">{loadState.fileName}</span> — total:{' '}
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

          <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
            <PageSizeCard
              value={pageSize}
              onChange={setPageSize}
              disabled={loadState.status !== 'success'}
            />

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resumo
                </CardTitle>
                <CardDescription>Informações do que está em memória (simulação da tabela).</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de palavras</span>
                    <span className="text-sm font-semibold">{totalWords}</span>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Prévia (primeiras 10)</p>
                  <div className="mt-3 space-y-1 text-sm">
                    {words.slice(0, 10).map((w, idx) => (
                      <div key={`${w}-${idx}`} className="rounded-lg border bg-background px-3 py-2">
                        {w}
                      </div>
                    ))}
                    {words.length === 0 && (
                      <div className="text-sm text-muted-foreground">Nenhuma palavra carregada.</div>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full rounded-xl"
                  disabled={!canProceedToHU03}
                  onClick={handleDividePreview}
                >
                  Dividir em páginas (HU03)
                </Button>

                {!canProceedToHU03 && (
                  <p className="text-xs text-muted-foreground">
                    Para continuar: carregue o arquivo e informe um tamanho de página válido.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}