
'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Boxes,
  Hash,
  Search,
  Loader2,
  X,
  CircleAlert,
} from 'lucide-react'

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
import type { IndexSearchResult, TableScanResult } from '@/services/hash-index'
import { buildPages } from '@/services/paging'
import {
  buildIndexFromPages,
  calculateNB,
  hashKeyToBucket,
  isValidNB,
  searchKeyInIndex,
  tableScanSearch,
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

type BusyAction = 'divide' | 'build' | 'index-search' | 'table-scan' | null
type ToastType = 'success' | 'error' | 'warning'
type AppToast = {
  id: number
  type: ToastType
  title: string
  description: string
}

const formatDuration = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${ms.toFixed(2)} ms`
}

const waitNextTick = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
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
  const [searchKey, setSearchKey] = useState<string>('')

  const [hashIndex, setHashIndex] = useState<HashIndex | null>(null)
  const [buildStats, setBuildStats] = useState<HashBuildStats | null>(null)
  const [indexSearchResult, setIndexSearchResult] = useState<IndexSearchResult | null>(null)
  const [tableScanResult, setTableScanResult] = useState<TableScanResult | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [toasts, setToasts] = useState<AppToast[]>([])

  const isBusy = busyAction !== null || loadState.status === 'loading'

  const addToast = (type: ToastType, title: string, description: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, type, title, description }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }

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

  const canDividePages = loadState.status === 'success' && totalWords > 0 && pageSizeValidation.ok && !isBusy

  const nb = useMemo(() => {
    if (!frValidation.ok) return 0
    return calculateNB(totalWords, frValidation.n)
  }, [totalWords, frValidation])

  const ruleOk = useMemo(() => {
    if (!frValidation.ok) return false
    return isValidNB(totalWords, frValidation.n, nb)
  }, [totalWords, frValidation, nb])

  const canBuildIndex = pagesMeta.status === 'ready' && totalWords > 0 && frValidation.ok && ruleOk && nb > 0 && !isBusy

  const sampleBucket = useMemo(() => {
    if (sampleKey.trim().length === 0 || nb <= 0) return null
    return hashKeyToBucket(sampleKey.trim(), nb, hashFunction)
  }, [sampleKey, nb, hashFunction])

  const canSearch = useMemo(() => hashIndex !== null && searchKey.trim().length > 0 && !isBusy, [hashIndex, searchKey, isBusy])
  const canScan = useMemo(() => pagesMeta.status === 'ready' && searchKey.trim().length > 0 && !isBusy, [pagesMeta.status, searchKey, isBusy])

  const comparison = useMemo(() => {
    if (!indexSearchResult || !tableScanResult) return null

    const timeDiffMs = tableScanResult.timeMs - indexSearchResult.timeMs
    const costDiffPages = tableScanResult.costEstimatePages - indexSearchResult.costEstimatePages
    const timeGainPercent = tableScanResult.timeMs <= 0 ? 0 : (timeDiffMs / tableScanResult.timeMs) * 100
    const costGainPercent =
      tableScanResult.costEstimatePages <= 0 ? 0 : (costDiffPages / tableScanResult.costEstimatePages) * 100

    return { timeDiffMs, costDiffPages, timeGainPercent, costGainPercent }
  }, [indexSearchResult, tableScanResult])

  const reset = () => {
    if (isBusy) return
    setWords([])
    setLoadState({ status: 'idle' })
    setPageSize('')
    pagesRef.current = []
    setPagesMeta({ status: 'idle' })
    setHashIndex(null)
    setBuildStats(null)
    setSampleKey('')
    setSearchKey('')
    setIndexSearchResult(null)
    setTableScanResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    addToast('success', 'Dados limpos', 'O estado da simulação foi reiniciado.')
  }
  const readTxtFile = async (file: File) => {
    setLoadState({ status: 'loading' })
    setPagesMeta({ status: 'idle' })
    pagesRef.current = []
    setHashIndex(null)
    setBuildStats(null)
    setIndexSearchResult(null)
    setTableScanResult(null)

    try {
      if (!file.name.toLowerCase().endsWith('.txt')) {
        setWords([])
        setLoadState({ status: 'error', message: 'Selecione um arquivo .txt' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        addToast('error', 'Arquivo inválido', 'Selecione um arquivo com extensão .txt.')
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
        addToast('warning', 'Arquivo vazio', 'Nenhum registro foi encontrado no arquivo.')
        return
      }

      setWords(lines)
      setLoadState({ status: 'success', total: lines.length, fileName: file.name })
      addToast('success', 'Arquivo carregado', `${lines.length} palavras lidas com sucesso.`)
    } catch {
      setWords([])
      setLoadState({ status: 'error', message: 'Não foi possível ler o arquivo.' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      addToast('error', 'Falha ao ler arquivo', 'Não foi possível processar o arquivo selecionado.')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return
    const file = e.target.files?.[0]
    if (!file) return
    await readTxtFile(file)
  }

  const handleDividePages = async () => {
    if (!canDividePages) return
    setBusyAction('divide')

    try {
      await waitNextTick()
      const pages = buildPages(words, pageSizeValidation.n)
      pagesRef.current = pages

      const totalPages = pages.length
      const first = pages[0]
      const last = pages[totalPages - 1]

      setHashIndex(null)
      setBuildStats(null)
      setIndexSearchResult(null)
      setTableScanResult(null)

      setPagesMeta({
        status: 'ready',
        totalPages,
        firstPage: { pageNumber: first.pageNumber, preview: first.records.slice(0, 5) },
        lastPage: { pageNumber: last.pageNumber, preview: last.records.slice(0, 5) },
      })
      addToast('success', 'Páginas criadas', `${totalPages} páginas geradas com sucesso.`)
    } catch {
      addToast('error', 'Falha ao dividir páginas', 'Não foi possível dividir os registros em páginas.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleBuildIndex = async () => {
    if (!canBuildIndex) return
    setBusyAction('build')

    try {
      await waitNextTick()
      const result = buildIndexFromPages(pagesRef.current, frValidation.n, nb, hashFunction)
      setHashIndex(result.index)
      setBuildStats(result.stats)
      setIndexSearchResult(null)
      addToast('success', 'Índice construído', `${result.stats.totalInserted} registros indexados em ${formatDuration(result.stats.buildTimeMs)}.`)
    } catch {
      addToast('error', 'Falha na construção', 'Não foi possível construir o índice com os parâmetros atuais.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSearchByIndex = async () => {
    if (!hashIndex) return
    const key = searchKey.trim()
    if (!key) return
    setBusyAction('index-search')

    try {
      await waitNextTick()
      const result = searchKeyInIndex(key, pagesRef.current, hashIndex, hashFunction)
      setIndexSearchResult(result)
      addToast(
        result.found ? 'success' : 'warning',
        result.found ? 'Chave encontrada no índice' : 'Chave não encontrada no índice',
        `Busca concluída em ${formatDuration(result.timeMs)} com custo ${result.costEstimatePages}.`
      )
    } catch {
      addToast('error', 'Falha na busca por índice', 'Ocorreu um erro ao processar a busca no índice.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleTableScan = async () => {
    const key = searchKey.trim()
    if (!key) return
    setBusyAction('table-scan')

    try {
      await waitNextTick()
      const result = tableScanSearch(key, pagesRef.current)
      setTableScanResult(result)
      addToast(
        result.found ? 'success' : 'warning',
        result.found ? 'Chave encontrada no table scan' : 'Chave não encontrada no table scan',
        `Scan concluído em ${formatDuration(result.timeMs)} com ${result.pagesRead} páginas lidas.`
      )
    } catch {
      addToast('error', 'Falha no table scan', 'Ocorreu um erro ao executar o scan sequencial.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="fixed right-4 top-4 z-50 flex w-[360px] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border p-3 shadow-sm backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : toast.type === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4" />}
                {toast.type === 'warning' && <CircleAlert className="mt-0.5 h-4 w-4" />}
                {toast.type === 'error' && <AlertCircle className="mt-0.5 h-4 w-4" />}
                <div>
                  <div className="text-sm font-semibold">{toast.title}</div>
                  <div className="text-xs text-muted-foreground">{toast.description}</div>
                </div>
              </div>
              <button type="button" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="rounded p-1 hover:bg-black/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Índice Hash Estático</h1>
            <p className="text-muted-foreground">Carregue o arquivo, divida em páginas, construa o índice e compare com table scan.</p>
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
                <Input ref={fileInputRef} id="wordsFile" type="file" accept=".txt,text/plain" onChange={handleFileChange} disabled={isBusy} />
                <p className="text-xs text-muted-foreground">O arquivo não fica no repositório. Você seleciona do seu computador.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy} className="rounded-xl">
                  {loadState.status === 'loading' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</>
                  ) : (
                    'Selecionar'
                  )}
                </Button>

                <Button type="button" variant="outline" onClick={reset} className="rounded-xl" disabled={isBusy}>Limpar</Button>
              </div>

              {loadState.status === 'idle' && <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Nenhum arquivo carregado ainda.</div>}
              {loadState.status === 'loading' && <div className="rounded-xl border bg-muted/40 p-4 text-sm">Carregando arquivo...</div>}

              {loadState.status === 'success' && (
                <Alert className="rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Arquivo carregado</AlertTitle>
                  <AlertDescription><span className="font-medium">{loadState.fileName}</span> - total de palavras: <span className="font-semibold">{loadState.total}</span></AlertDescription>
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
            <PageSizeCard value={pageSize} onChange={setPageSize} disabled={loadState.status !== 'success' || isBusy} canDivide={canDividePages} onDivide={() => void handleDividePages()} isLoading={busyAction === 'divide'} />

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Total em memória</CardTitle><CardDescription>Quantidade de registros carregados para simular a tabela.</CardDescription></CardHeader>
              <CardContent><div className="rounded-xl border p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total de palavras</span><span className="text-sm font-semibold">{totalWords}</span></div></div></CardContent>
            </Card>

            <div className="lg:col-span-2">
              <PagesPreviewCard totalPages={pagesMeta.status === 'ready' ? pagesMeta.totalPages : 0} firstPage={pagesMeta.status === 'ready' ? pagesMeta.firstPage : undefined} lastPage={pagesMeta.status === 'ready' ? pagesMeta.lastPage : undefined} />
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Hash className="h-5 w-5" />Configuração da função hash</CardTitle>
                  <CardDescription>Escolha a função para mapear chave em bucket.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="hashFunction">Função hash</Label>
                      <select id="hashFunction" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={hashFunction} onChange={(e) => setHashFunction(e.target.value as HashFunctionName)} disabled={isBusy}>
                        <option value="djb2">djb2 (recomendada)</option>
                        <option value="charCodeSum">charCodeSum (simples)</option>
                      </select>
                    </div>
                    <div className="space-y-2"><Label htmlFor="sampleKey">Chave de teste</Label><Input id="sampleKey" value={sampleKey} onChange={(e) => setSampleKey(e.target.value)} placeholder="Ex: banana" disabled={isBusy} /></div>
                  </div>
                  <div className="rounded-xl border p-4 text-sm">{sampleBucket === null ? <span className="text-muted-foreground">Informe uma chave para visualizar o bucket calculado.</span> : <span>Bucket calculado: <span className="font-semibold">{sampleBucket}</span> (intervalo válido: 0..{Math.max(nb - 1, 0)}).</span>}</div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <IndexSetupCard frValue={fr} onChangeFR={(v) => { setFr(v); setHashIndex(null); setBuildStats(null); setIndexSearchResult(null) }} nr={totalWords} nb={nb} ruleOk={ruleOk} disabled={pagesMeta.status !== 'ready' || isBusy} canCreate={canBuildIndex} onCreate={() => void handleBuildIndex()} created={hashIndex ? { fr: hashIndex.fr, nb: hashIndex.nb } : undefined} isLoading={busyAction === 'build'} />
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" />Índice construído</CardTitle><CardDescription>Registros inseridos com resolução de colisões e estratégia de overflow.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {!hashIndex && <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Construa o índice para ver os buckets preenchidos e as métricas.</div>}
                  {hashIndex && buildStats && (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Registros indexados</span><span className="font-semibold">{buildStats.totalInserted}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Tempo de construção</span><span className="font-semibold">{formatDuration(buildStats.buildTimeMs)}</span></div></div>
                        <div className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Colisões</span><span className="font-semibold">{buildStats.collisions}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Taxa de colisão</span><span className="font-semibold">{buildStats.collisionsRate.toFixed(2)}%</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Buckets com overflow</span><span className="font-semibold">{buildStats.overflowedBuckets}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Taxa de overflow</span><span className="font-semibold">{buildStats.overflowRate.toFixed(2)}%</span></div></div>
                      </div>
                      {hashIndex.buckets.slice(0, 6).map((bucket) => (
                        <div key={bucket.id} className="rounded-xl border p-4 text-sm">
                          <div className="flex items-center justify-between"><span className="font-medium">Bucket {bucket.id}</span><span className="text-muted-foreground">{bucket.entries.length}/{bucket.capacity}</span></div>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">{bucket.entries.slice(0, 3).map((entry) => <div key={`${bucket.id}-${entry.key}`}>{entry.key} -&gt; página {entry.pageNumber} (home {entry.homeBucketId}){entry.isOverflow ? ' [overflow]' : ''}</div>)}{bucket.entries.length === 0 && <div>Sem entradas.</div>}</div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="rounded-2xl">
                <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Busca e comparação</CardTitle><CardDescription>Busque por índice e compare com table scan.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><Input placeholder="Digite a chave de busca" value={searchKey} onChange={(e) => setSearchKey(e.target.value)} disabled={isBusy} />
                    <Button type="button" onClick={() => void handleSearchByIndex()} disabled={!canSearch}>{busyAction === 'index-search' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando...</> : 'Buscar no índice'}</Button>
                    <Button type="button" variant="outline" onClick={() => void handleTableScan()} disabled={!canScan}>{busyAction === 'table-scan' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lendo...</> : 'Table scan'}</Button>
                  </div>

                  {indexSearchResult && <div className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Busca por índice</span><span className="font-semibold">{indexSearchResult.found ? 'Encontrada' : 'Não encontrada'}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Página</span><span className="font-semibold">{indexSearchResult.pageNumber ?? '-'}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Buckets visitados</span><span className="font-semibold">{indexSearchResult.visitedBuckets.join(', ')}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Custo estimado (leituras)</span><span className="font-semibold">{indexSearchResult.costEstimatePages}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Tempo</span><span className="font-semibold">{formatDuration(indexSearchResult.timeMs)}</span></div></div>}

                  {tableScanResult && <div className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Table scan</span><span className="font-semibold">{tableScanResult.found ? 'Encontrada' : 'Não encontrada'}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Página</span><span className="font-semibold">{tableScanResult.pageNumber ?? '-'}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Páginas lidas</span><span className="font-semibold">{tableScanResult.pagesRead}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Custo estimado (leituras)</span><span className="font-semibold">{tableScanResult.costEstimatePages}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Tempo</span><span className="font-semibold">{formatDuration(tableScanResult.timeMs)}</span></div></div>}

                  {comparison && <div className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Diferença de tempo (scan - índice)</span><span className="font-semibold">{formatDuration(comparison.timeDiffMs)}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Ganho percentual de tempo</span><span className="font-semibold">{comparison.timeGainPercent.toFixed(2)}%</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Diferença de custo (páginas)</span><span className="font-semibold">{comparison.costDiffPages}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-muted-foreground">Ganho percentual de custo</span><span className="font-semibold">{comparison.costGainPercent.toFixed(2)}%</span></div></div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
