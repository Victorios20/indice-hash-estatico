'use client'

import React from 'react'
import { Boxes } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import type { HashBuildStats, HashIndex } from '@/domain/hash-index'

type Props = {
  hashIndex: HashIndex | null
  buildStats: HashBuildStats | null
  highlightedBuckets: Set<number>
  formatDuration: (ms: number) => string
}

export function IndexBuiltCard({ hashIndex, buildStats, highlightedBuckets, formatDuration }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          Índice construído
        </CardTitle>
        <CardDescription>Registros inseridos com resolução de colisões e estratégia de overflow.</CardDescription>
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
                  <span className="font-semibold">{formatDuration(buildStats.buildTimeMs)}</span>
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
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Buckets com overflow</span>
                  <span className="font-semibold">{buildStats.overflowedBuckets}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Taxa de overflow</span>
                  <span className="font-semibold">{buildStats.overflowRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {hashIndex.buckets.slice(0, 10).map((bucket) => {
              const isVisited = highlightedBuckets.has(bucket.id)
              return (
                <div
                  key={bucket.id}
                  className={`rounded-xl border p-4 text-sm ${isVisited ? 'border-amber-500 bg-amber-500/10' : ''}`}
                >
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
                        {entry.isOverflow ? ' [overflow]' : ''}
                      </div>
                    ))}
                    {bucket.entries.length === 0 && <div>Sem entradas.</div>}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </CardContent>
    </Card>
  )
}
