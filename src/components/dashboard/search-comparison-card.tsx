'use client'

import React from 'react'
import { Loader2, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import type { IndexSearchResult, TableScanResult } from '@/services/hash-index'

type BusyAction = 'divide' | 'build' | 'index-search' | 'table-scan' | null

type Comparison = {
  timeDiffMs: number
  costDiffPages: number
  timeGainPercent: number
  costGainPercent: number
}

type Props = {
  searchKey: string
  onChangeSearchKey: (next: string) => void
  isBusy: boolean
  canSearch: boolean
  canScan: boolean
  busyAction: BusyAction
  onSearchByIndex: () => void
  onTableScan: () => void
  indexSearchResult: IndexSearchResult | null
  tableScanResult: TableScanResult | null
  comparison: Comparison | null
  formatDuration: (ms: number) => string
}

export function SearchComparisonCard({
  searchKey,
  onChangeSearchKey,
  isBusy,
  canSearch,
  canScan,
  busyAction,
  onSearchByIndex,
  onTableScan,
  indexSearchResult,
  tableScanResult,
  comparison,
  formatDuration,
}: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Busca e comparação
        </CardTitle>
        <CardDescription>Busque por índice e compare com table scan.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder="Digite a chave de busca"
            value={searchKey}
            onChange={(e) => onChangeSearchKey(e.target.value)}
            disabled={isBusy}
          />

          <Button type="button" onClick={onSearchByIndex} disabled={!canSearch}>
            {busyAction === 'index-search' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              'Buscar no índice'
            )}
          </Button>

          <Button type="button" variant="outline" onClick={onTableScan} disabled={!canScan}>
            {busyAction === 'table-scan' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lendo...
              </>
            ) : (
              'Table scan'
            )}
          </Button>
        </div>

        {indexSearchResult && (
          <div className="rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Busca por índice</span>
              <span className="font-semibold">{indexSearchResult.found ? 'Encontrada' : 'Não encontrada'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Página</span>
              <span className="font-semibold">{indexSearchResult.pageNumber ?? '-'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Buckets visitados</span>
              <span className="font-semibold">{indexSearchResult.visitedBuckets.join(', ')}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Custo estimado (leituras)</span>
              <span className="font-semibold">{indexSearchResult.costEstimatePages}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Tempo</span>
              <span className="font-semibold">{formatDuration(indexSearchResult.timeMs)}</span>
            </div>
          </div>
        )}

        {tableScanResult && (
          <div className="rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Table scan</span>
              <span className="font-semibold">{tableScanResult.found ? 'Encontrada' : 'Não encontrada'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Página</span>
              <span className="font-semibold">{tableScanResult.pageNumber ?? '-'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Páginas lidas</span>
              <span className="font-semibold">{tableScanResult.pagesRead}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Custo estimado (leituras)</span>
              <span className="font-semibold">{tableScanResult.costEstimatePages}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Tempo</span>
              <span className="font-semibold">{formatDuration(tableScanResult.timeMs)}</span>
            </div>

            <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="mb-2 font-medium">Registros lidos no scan</div>
              <div className="space-y-2">
                {tableScanResult.scannedPages.slice(0, 4).map((page) => (
                  <div key={page.pageNumber}>
                    <div className="font-medium">Página {page.pageNumber}</div>
                    <div className="text-muted-foreground">
                      {page.recordsRead.slice(0, 8).join(', ')}
                      {page.recordsRead.length > 8 ? ' ...' : ''}
                    </div>
                  </div>
                ))}
                {tableScanResult.scannedPages.length > 4 && (
                  <div className="text-muted-foreground">
                    + {tableScanResult.scannedPages.length - 4} páginas lidas.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {comparison && (
          <div className="rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diferença de tempo (scan - índice)</span>
              <span className="font-semibold">{formatDuration(comparison.timeDiffMs)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Ganho percentual de tempo</span>
              <span className="font-semibold">{comparison.timeGainPercent.toFixed(2)}%</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Diferença de custo (páginas)</span>
              <span className="font-semibold">{comparison.costDiffPages}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Ganho percentual de custo</span>
              <span className="font-semibold">{comparison.costGainPercent.toFixed(2)}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
