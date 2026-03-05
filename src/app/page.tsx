'use client'

import React, { useMemo, useRef, useState } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { PageSizeCard } from '@/components/page-size-card'
import { PagesPreviewCard } from '@/components/pages-preview-card'
import { IndexSetupCard } from '@/components/index-setup-card'
import { UploadCard } from '@/components/dashboard/upload-card'
import { TotalMemoryCard } from '@/components/dashboard/total-memory-card'
import { HashFunctionCard } from '@/components/dashboard/hash-function-card'
import { IndexBuiltCard } from '@/components/dashboard/index-built-card'
import { SearchComparisonCard } from '@/components/dashboard/search-comparison-card'
import { HighlightedPageCard } from '@/components/dashboard/highlighted-page-card'
import { ToastStack, type DashboardToast } from '@/components/dashboard/toast-stack'

import type { Page } from '@/domain/page'
import type { HashBuildStats, HashFunctionName, HashIndex } from '@/domain/hash-index'
import type { IndexSearchResult, TableScanResult } from '@/services/hash-index'
import { buildPagesAsync } from '@/services/paging'
import {
  buildIndexFromPagesAsync,
  calculateNB,
  hashKeyToBucket,
  isValidNB,
  searchKeyInIndex,
  tableScanSearchAsync,
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

type Comparison = {
  timeDiffMs: number
  costDiffPages: number
  timeGainPercent: number
  costGainPercent: number
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
  const [toasts, setToasts] = useState<DashboardToast[]>([])

  const isBusy = busyAction !== null || loadState.status === 'loading'

  const addToast = (type: DashboardToast['type'], title: string, description: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, type, title, description }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
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

  const canDividePages =
    loadState.status === 'success' && totalWords > 0 && pageSizeValidation.ok && !isBusy

  const nb = useMemo(() => {
    if (!frValidation.ok) return 0
    return calculateNB(totalWords, frValidation.n)
  }, [totalWords, frValidation])

  const ruleOk = useMemo(() => {
    if (!frValidation.ok) return false
    return isValidNB(totalWords, frValidation.n, nb)
  }, [totalWords, frValidation, nb])

  const canBuildIndex =
    pagesMeta.status === 'ready' && totalWords > 0 && frValidation.ok && ruleOk && nb > 0 && !isBusy

  const sampleBucket = useMemo(() => {
    if (sampleKey.trim().length === 0 || nb <= 0) return null
    return hashKeyToBucket(sampleKey.trim(), nb, hashFunction)
  }, [sampleKey, nb, hashFunction])

  const canSearch = useMemo(
    () => hashIndex !== null && searchKey.trim().length > 0 && !isBusy,
    [hashIndex, searchKey, isBusy]
  )

  const canScan = useMemo(
    () => pagesMeta.status === 'ready' && searchKey.trim().length > 0 && !isBusy,
    [pagesMeta.status, searchKey, isBusy]
  )

  const comparison = useMemo<Comparison | null>(() => {
    if (!indexSearchResult || !tableScanResult) return null

    const timeDiffMs = tableScanResult.timeMs - indexSearchResult.timeMs
    const costDiffPages = tableScanResult.costEstimatePages - indexSearchResult.costEstimatePages
    const timeGainPercent = tableScanResult.timeMs <= 0 ? 0 : (timeDiffMs / tableScanResult.timeMs) * 100
    const costGainPercent =
      tableScanResult.costEstimatePages <= 0
        ? 0
        : (costDiffPages / tableScanResult.costEstimatePages) * 100

    return { timeDiffMs, costDiffPages, timeGainPercent, costGainPercent }
  }, [indexSearchResult, tableScanResult])

  const highlightedBuckets = useMemo(() => {
    if (!indexSearchResult) return new Set<number>()
    return new Set(indexSearchResult.visitedBuckets)
  }, [indexSearchResult])

  const highlightedPageNumber = useMemo(() => {
    if (indexSearchResult?.found) return indexSearchResult.pageNumber
    if (tableScanResult?.found) return tableScanResult.pageNumber
    return undefined
  }, [indexSearchResult, tableScanResult])

  const highlightedPage = useMemo(() => {
    if (!highlightedPageNumber) return null
    return pagesRef.current[highlightedPageNumber - 1] ?? null
  }, [highlightedPageNumber, indexSearchResult, tableScanResult])

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
      const pages = await buildPagesAsync(words, pageSizeValidation.n)
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
      const result = await buildIndexFromPagesAsync(pagesRef.current, frValidation.n, nb, hashFunction)
      setHashIndex(result.index)
      setBuildStats(result.stats)
      setIndexSearchResult(null)
      addToast(
        'success',
        'Índice construído',
        `${result.stats.totalInserted} registros indexados em ${formatDuration(result.stats.buildTimeMs)}.`
      )
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
      const result = await tableScanSearchAsync(key, pagesRef.current)
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
      <ToastStack toasts={toasts} onDismiss={removeToast} />

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Índice Hash Estático</h1>
            <p className="text-muted-foreground">
              Fluxo guiado em etapas: carga, paginação, construção do índice e comparação de buscas.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Etapa 1: Carga e Paginação</h2>
            <p className="text-sm text-muted-foreground">Carregue o arquivo e divida os registros em páginas.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <UploadCard
                fileInputRef={fileInputRef}
                loadState={loadState}
                isBusy={isBusy}
                onFileChange={handleFileChange}
                onReset={reset}
              />
            </div>

            <div className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
              <PageSizeCard
                value={pageSize}
                onChange={setPageSize}
                disabled={loadState.status !== 'success' || isBusy}
                canDivide={canDividePages}
                onDivide={() => void handleDividePages()}
                isLoading={busyAction === 'divide'}
              />

              <TotalMemoryCard totalWords={totalWords} />

              <div className="lg:col-span-2">
                <PagesPreviewCard
                  totalPages={pagesMeta.status === 'ready' ? pagesMeta.totalPages : 0}
                  firstPage={pagesMeta.status === 'ready' ? pagesMeta.firstPage : undefined}
                  lastPage={pagesMeta.status === 'ready' ? pagesMeta.lastPage : undefined}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Etapa 2: Construção do Índice</h2>
            <p className="text-sm text-muted-foreground">Configure hash/FR, construa o índice e analise buckets/métricas.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <HashFunctionCard
              hashFunction={hashFunction}
              onChangeHashFunction={setHashFunction}
              sampleKey={sampleKey}
              onChangeSampleKey={setSampleKey}
              sampleBucket={sampleBucket}
              nb={nb}
              isBusy={isBusy}
            />

            <IndexSetupCard
              frValue={fr}
              onChangeFR={(v) => {
                setFr(v)
                setHashIndex(null)
                setBuildStats(null)
                setIndexSearchResult(null)
              }}
              nr={totalWords}
              nb={nb}
              ruleOk={ruleOk}
              disabled={pagesMeta.status !== 'ready' || isBusy}
              canCreate={canBuildIndex}
              onCreate={() => void handleBuildIndex()}
              created={hashIndex ? { fr: hashIndex.fr, nb: hashIndex.nb } : undefined}
              isLoading={busyAction === 'build'}
            />

            <div className="lg:col-span-2">
              <IndexBuiltCard
                hashIndex={hashIndex}
                buildStats={buildStats}
                highlightedBuckets={highlightedBuckets}
                formatDuration={formatDuration}
              />
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Etapa 3: Busca e Comparação</h2>
            <p className="text-sm text-muted-foreground">Execute busca por índice, table scan e compare custo/tempo.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <SearchComparisonCard
                searchKey={searchKey}
                onChangeSearchKey={setSearchKey}
                isBusy={isBusy}
                canSearch={canSearch}
                canScan={canScan}
                busyAction={busyAction}
                onSearchByIndex={() => void handleSearchByIndex()}
                onTableScan={() => void handleTableScan()}
                indexSearchResult={indexSearchResult}
                tableScanResult={tableScanResult}
                comparison={comparison}
                formatDuration={formatDuration}
              />
            </div>

            <div className="lg:col-span-2">
              <HighlightedPageCard highlightedPage={highlightedPage} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
