'use client'

import React, { useMemo, useRef, useState } from 'react'
import { Upload, AlertCircle, CheckCircle2, Boxes } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ThemeToggle } from '@/components/theme-toggle'
import { PageSizeCard } from '@/components/page-size-card'
import { PagesPreviewCard } from '@/components/pages-preview-card'
import { IndexSetupCard } from '@/components/index-setup-card'

import type { Page } from '@/domain/page'
import { buildPages } from '@/services/paging'

import type { HashIndex } from '@/domain/hash-index'
import { calculateNB, createEmptyIndex, isValidNB } from '@/services/hash-index'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; total: number; fileName: string }
  | { status: 'error'; message: string }

type PagesMeta =
  | { status: 'idle' }
  | {
      status: 'ready'
      totalPages: number
      firstPage: { pageNumber: number; preview: string[] }
      lastPage: { pageNumber: number; preview: string[] }
    }

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' })
  const [words, setWords] = useState<string[]>([])
  const [pageSize, setPageSize] = useState<string>('')

  const pagesRef = useRef<Page[]>([])
  const [pagesMeta, setPagesMeta] = useState<PagesMeta>({ status: 'idle' })

  const [fr, setFr] = useState<string>('4')
  const [hashIndex, setHashIndex] = useState<HashIndex | null>(null)

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

  const frValidation = useMemo(() => {
    const raw = fr.trim()
    if (raw.length === 0) return { ok: false, n: 0 }
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, n: 0 }
    if (!Number.isInteger(n)) return { ok: false, n: 0 }
    if (n <= 0) return { ok: false, n: 0 }
    return { ok: true, n }
  }, [fr])

  const canDividePages =
    loadState.status === 'success' && totalWords > 0 && pageSizeValidation.ok

  const nb = useMemo(() => {
    if (!frValidation.ok) return 0
    return calculateNB(totalWords, frValidation.n)
  }, [totalWords, frValidation])

  const ruleOk = useMemo(() => {
    if (!frValidation.ok) return false
    return isValidNB(totalWords, frValidation.n, nb)
  }, [totalWords, frValidation, nb])

  const canCreateBuckets =
    pagesMeta.status === 'ready' && totalWords > 0 && frValidation.ok && ruleOk && nb > 0

  const reset = () => {
    setWords([])
    setLoadState({ status: 'idle' })
    setPageSize('')
    pagesRef.current = []
    setPagesMeta({ status: 'idle' })
    setHashIndex(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readTxtFile = async (file: File) => {
    setLoadState({ status: 'loading' })
    setPagesMeta({ status: 'idle' })
    pagesRef.current = []
    setHashIndex(null)

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
        setLoadState({ status: 'error', message: 'O arquivo estÃ¡ vazio.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      setWords(lines)
      setLoadState({ status: 'success', total: lines.length, fileName: file.name })
    } catch {
      setWords([])
      setLoadState({ status: 'error', message: 'NÃ£o foi possÃ­vel ler o arquivo.' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await readTxtFile(file)
  }

  const handleDividePages = () => {
    if (!canDividePages) return

    const pages = buildPages(words, pageSizeValidation.n)
    pagesRef.current = pages

    const totalPages = pages.length
    const first = pages[0]
    const last = pages[totalPages - 1]

    setHashIndex(null)

    setPagesMeta({
      status: 'ready',
      totalPages,
      firstPage: { pageNumber: first.pageNumber, preview: first.records.slice(0, 5) },
      lastPage: { pageNumber: last.pageNumber, preview: last.records.slice(0, 5) },
    })
  }

  const handleCreateBuckets = () => {
    if (!canCreateBuckets) return
    const index = createEmptyIndex(totalWords, frValidation.n, nb)
    setHashIndex(index)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Ãndice Hash EstÃ¡tico</h1>
            <p className="text-muted-foreground">
              Carregue o arquivo, divida em pÃ¡ginas e crie os buckets do Ã­ndice.
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
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  O arquivo nÃ£o fica no repositÃ³rio. VocÃª seleciona do seu computador.
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

                <Button type="button" variant="outline" onClick={reset} className="rounded-xl">
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
                    <span className="font-medium">{loadState.fileName}</span> â€” total de palavras:{' '}
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
              canDivide={canDividePages}
              onDivide={handleDividePages}
            />

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Total em memÃ³ria</CardTitle>
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

            <div className="lg:col-span-2">
              <PagesPreviewCard
                totalPages={pagesMeta.status === 'ready' ? pagesMeta.totalPages : 0}
                firstPage={pagesMeta.status === 'ready' ? pagesMeta.firstPage : undefined}
                lastPage={pagesMeta.status === 'ready' ? pagesMeta.lastPage : undefined}
              />
            </div>

            <div className="lg:col-span-2">
              <IndexSetupCard
                frValue={fr}
                onChangeFR={(v) => {
                  setFr(v)
                  setHashIndex(null)
                }}
                nr={totalWords}
                nb={nb}
                ruleOk={ruleOk}
                disabled={pagesMeta.status !== 'ready'}
                canCreate={canCreateBuckets}
                onCreate={handleCreateBuckets}
                created={hashIndex ? { fr: hashIndex.fr, nb: hashIndex.nb } : undefined}
              />
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="h-5 w-5" />
                    Buckets criados
                  </CardTitle>
                  <CardDescription>PrÃ©via dos primeiros buckets (ainda vazios nesta etapa).</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!hashIndex && (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Crie os buckets para ver a prÃ©via aqui.
                    </div>
                  )}

                  {hashIndex && (
                    <div className="space-y-2">
                      <div className="rounded-xl border p-4 text-sm">
                        <span className="text-muted-foreground">FR:</span>{' '}
                        <span className="font-semibold">{hashIndex.fr}</span>{' '}
                        <span className="text-muted-foreground">NB:</span>{' '}
                        <span className="font-semibold">{hashIndex.nb}</span>
                      </div>

                      {hashIndex.buckets.slice(0, 6).map((b) => (
                        <div key={b.id} className="rounded-xl border p-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Bucket {b.id}</span>
                            <span className="text-muted-foreground">
                              {b.entries.length}/{b.capacity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

