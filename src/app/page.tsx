'use client'

import React, { useMemo, useRef, useState } from 'react'
import { Upload, AlertCircle, CheckCircle2, Boxes, Hash } from 'lucide-react'

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
import type { HashBuildStats, HashFunctionName, HashIndex } from '@/domain/hash-index'
import { buildPages } from '@/services/paging'
import {
  buildIndexFromPages,
  calculateNB,
  hashKeyToBucket,
  isValidNB,
} from '@/services/hash-index'

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
  const [hashFunction, setHashFunction] = useState<HashFunctionName>('djb2')
  const [sampleKey, setSampleKey] = useState<string>('')

  const [hashIndex, setHashIndex] = useState<HashIndex | null>(null)
  const [buildStats, setBuildStats] = useState<HashBuildStats | null>(null)

  const totalWords = useMemo(() => words.length, [words])

  const pageSizeValidation = useMemo(() => {
    const raw = pageSize.trim()
    if (raw.length === 0) return { ok: false, n: 0 }
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok: false, n: 0 }
    return { ok: true, n }
  }, [pageSize])

  const frValidation = useMemo(() => {
    const raw = fr.trim()
    if (raw.length === 0) return { ok: false, n: 0 }
    const n = Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok: false, n: 0 }
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

  const canBuildIndex =
    pagesMeta.status === 'ready' && totalWords > 0 && frValidation.ok && ruleOk && nb > 0

  const sampleBucket = useMemo(() => {
    if (sampleKey.trim().length === 0 || nb <= 0) return null
    return hashKeyToBucket(sampleKey.trim(), nb, hashFunction)
  }, [sampleKey, nb, hashFunction])

  const reset = () => {
    setWords([])
    setLoadState({ status: 'idle' })
    setPageSize('')
    pagesRef.current = []
    setPagesMeta({ status: 'idle' })
    setHashIndex(null)
    setBuildStats(null)
    setSampleKey('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readTxtFile = async (file: File) => {
    setLoadState({ status: 'loading' })
    setPagesMeta({ status: 'idle' })
    pagesRef.current = []
    setHashIndex(null)
    setBuildStats(null)

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
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

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

  const handleDividePages = () => {
    if (!canDividePages) return

    const pages = buildPages(words, pageSizeValidation.n)
    pagesRef.current = pages

    const totalPages = pages.length
    const first = pages[0]
    const last = pages[totalPages - 1]

    setHashIndex(null)
    setBuildStats(null)

    setPagesMeta({
      status: 'ready',
      totalPages,
      firstPage: { pageNumber: first.pageNumber, preview: first.records.slice(0, 5) },
      lastPage: { pageNumber: last.pageNumber, preview: last.records.slice(0, 5) },
    })
  }

  const handleBuildIndex = () => {
    if (!canBuildIndex) return

    const result = buildIndexFromPages(pagesRef.current, frValidation.n, nb, hashFunction)
    setHashIndex(result.index)
    setBuildStats(result.stats)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Índice Hash Estático</h1>
            <p className="text-muted-foreground">
              Carregue o arquivo, divida em páginas e construa o índice hash.
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

            <div className="lg:col-span-2">
              <PagesPreviewCard
                totalPages={pagesMeta.status === 'ready' ? pagesMeta.totalPages : 0}
                firstPage={pagesMeta.status === 'ready' ? pagesMeta.firstPage : undefined}
                lastPage={pagesMeta.status === 'ready' ? pagesMeta.lastPage : undefined}
              />
            </div>

            <div className="lg:col-span-2">
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
                        onChange={(e) => setHashFunction(e.target.value as HashFunctionName)}
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
                        onChange={(e) => setSampleKey(e.target.value)}
                        placeholder="Ex: banana"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border p-4 text-sm">
                    {sampleBucket === null ? (
                      <span className="text-muted-foreground">
                        Informe uma chave para visualizar o bucket calculado.
                      </span>
                    ) : (
                      <span>
                        Bucket calculado: <span className="font-semibold">{sampleBucket}</span> (intervalo
                        válido: 0..{Math.max(nb - 1, 0)}).
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <IndexSetupCard
                frValue={fr}
                onChangeFR={(v) => {
                  setFr(v)
                  setHashIndex(null)
                  setBuildStats(null)
                }}
                nr={totalWords}
                nb={nb}
                ruleOk={ruleOk}
                disabled={pagesMeta.status !== 'ready'}
                canCreate={canBuildIndex}
                onCreate={handleBuildIndex}
                created={hashIndex ? { fr: hashIndex.fr, nb: hashIndex.nb } : undefined}
              />
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="h-5 w-5" />
                    Índice construído
                  </CardTitle>
                  <CardDescription>
                    Registros inseridos com resolução de colisões por linear probing.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {!hashIndex && (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Construa o índice para ver os buckets preenchidos e as métricas.
                    </div>
                  )}

                  {hashIndex && buildStats && (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border p-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Registros indexados</span>
                            <span className="font-semibold">{buildStats.totalInserted}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-muted-foreground">Tempo de construção</span>
                            <span className="font-semibold">{buildStats.buildTimeMs.toFixed(2)} ms</span>
                          </div>
                        </div>

                        <div className="rounded-xl border p-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Colisões</span>
                            <span className="font-semibold">{buildStats.collisions}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-muted-foreground">Taxa de colisão</span>
                            <span className="font-semibold">{buildStats.collisionsRate.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>

                      {hashIndex.buckets.slice(0, 6).map((bucket) => (
                        <div key={bucket.id} className="rounded-xl border p-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Bucket {bucket.id}</span>
                            <span className="text-muted-foreground">
                              {bucket.entries.length}/{bucket.capacity}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {bucket.entries.slice(0, 3).map((entry) => (
                              <div key={`${bucket.id}-${entry.key}`}>
                                {entry.key} -&gt; página {entry.pageNumber} (home {entry.homeBucketId})
                              </div>
                            ))}
                            {bucket.entries.length === 0 && <div>Sem entradas.</div>}
                          </div>
                        </div>
                      ))}
                    </>
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


