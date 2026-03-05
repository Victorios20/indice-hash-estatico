import type { Page } from '@/domain/page'
import type {
  Bucket,
  BucketEntry,
  HashBuildResult,
  HashFunctionName,
  HashIndex,
} from '@/domain/hash-index'

export type { HashFunctionName } from '@/domain/hash-index'

export type IndexSearchResult = {
  found: boolean
  key: string
  pageNumber?: number
  bucketsProbed: number
  costEstimatePages: number
  visitedBuckets: number[]
  timeMs: number
}

export type TableScanResult = {
  found: boolean
  key: string
  pageNumber?: number
  pagesRead: number
  costEstimatePages: number
  scannedPages: Array<{ pageNumber: number; recordsRead: string[] }>
  timeMs: number
}

export const calculateNB = (nr: number, fr: number): number => {
  if (nr <= 0 || fr <= 0) return 0
  return Math.floor(nr / fr) + 1
}

export const isValidNB = (nr: number, fr: number, nb: number): boolean => {
  if (nr <= 0 || fr <= 0 || nb <= 0) return false
  return nb > nr / fr
}

export const createEmptyIndex = (_nr: number, fr: number, nb: number): HashIndex => {
  const buckets: Bucket[] = Array.from({ length: nb }, (_, i) => ({
    id: i,
    capacity: fr,
    entries: [],
  }))

  return { fr, nb, buckets }
}

const normalizeToBucketRange = (hash: number, nb: number): number => {
  const mod = hash % nb
  return mod < 0 ? mod + nb : mod
}

const hashDjb2 = (key: string): number => {
  let hash = 5381
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0
  }
  return hash
}

const hashCharCodeSum = (key: string): number => {
  let sum = 0
  for (let i = 0; i < key.length; i += 1) {
    sum += key.charCodeAt(i)
  }
  return sum >>> 0
}

export const hashKeyToBucket = (
  key: string,
  nb: number,
  strategy: HashFunctionName = 'djb2'
): number => {
  if (nb <= 0) throw new Error('NB deve ser maior que zero para calcular o hash.')

  const safeKey = key ?? ''
  const rawHash = strategy === 'charCodeSum' ? hashCharCodeSum(safeKey) : hashDjb2(safeKey)
  return normalizeToBucketRange(rawHash, nb)
}

const findBucketForInsert = (buckets: Bucket[], startBucketId: number): number => {
  const nb = buckets.length

  for (let offset = 0; offset < nb; offset += 1) {
    const bucketId = (startBucketId + offset) % nb
    const bucket = buckets[bucketId]

    if (bucket.entries.length < bucket.capacity) {
      return bucketId
    }
  }

  return -1
}

const buildStatsResult = (
  index: HashIndex,
  start: number,
  totalInserted: number,
  collisions: number,
  overflowedHomeBuckets: Set<number>
): HashBuildResult => {
  const end = performance.now()
  const collisionsRate = totalInserted === 0 ? 0 : (collisions / totalInserted) * 100
  const overflowedBuckets = overflowedHomeBuckets.size
  const overflowRate = index.nb === 0 ? 0 : (overflowedBuckets / index.nb) * 100

  return {
    index,
    stats: {
      totalInserted,
      collisions,
      collisionsRate,
      overflowedBuckets,
      overflowRate,
      buildTimeMs: end - start,
    },
  }
}

export const buildIndexFromPages = (
  pages: Page[],
  fr: number,
  nb: number,
  strategy: HashFunctionName = 'djb2'
): HashBuildResult => {
  const start = performance.now()
  const index = createEmptyIndex(0, fr, nb)

  let collisions = 0
  let totalInserted = 0
  const overflowedHomeBuckets = new Set<number>()

  for (const page of pages) {
    for (const key of page.records) {
      const homeBucketId = hashKeyToBucket(key, nb, strategy)
      const homeBucket = index.buckets[homeBucketId]

      const homeIsFull = homeBucket.entries.length >= homeBucket.capacity
      if (homeIsFull) {
        collisions += 1
        overflowedHomeBuckets.add(homeBucketId)
      }

      const targetBucketId = findBucketForInsert(index.buckets, homeBucketId)
      if (targetBucketId < 0) {
        throw new Error('Sem espaço para inserir no índice. Verifique FR/NB.')
      }

      const entry: BucketEntry = {
        key,
        pageNumber: page.pageNumber,
        homeBucketId,
        bucketId: targetBucketId,
        isOverflow: targetBucketId !== homeBucketId,
      }

      index.buckets[targetBucketId].entries.push(entry)
      totalInserted += 1
    }
  }

  return buildStatsResult(index, start, totalInserted, collisions, overflowedHomeBuckets)
}

const yieldToBrowser = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export const buildIndexFromPagesAsync = async (
  pages: Page[],
  fr: number,
  nb: number,
  strategy: HashFunctionName = 'djb2',
  chunkSize = 5000
): Promise<HashBuildResult> => {
  const start = performance.now()
  const index = createEmptyIndex(0, fr, nb)

  let collisions = 0
  let totalInserted = 0
  let processedInChunk = 0
  const overflowedHomeBuckets = new Set<number>()

  for (const page of pages) {
    for (const key of page.records) {
      const homeBucketId = hashKeyToBucket(key, nb, strategy)
      const homeBucket = index.buckets[homeBucketId]

      const homeIsFull = homeBucket.entries.length >= homeBucket.capacity
      if (homeIsFull) {
        collisions += 1
        overflowedHomeBuckets.add(homeBucketId)
      }

      const targetBucketId = findBucketForInsert(index.buckets, homeBucketId)
      if (targetBucketId < 0) {
        throw new Error('Sem espaço para inserir no índice. Verifique FR/NB.')
      }

      const entry: BucketEntry = {
        key,
        pageNumber: page.pageNumber,
        homeBucketId,
        bucketId: targetBucketId,
        isOverflow: targetBucketId !== homeBucketId,
      }

      index.buckets[targetBucketId].entries.push(entry)
      totalInserted += 1
      processedInChunk += 1

      if (processedInChunk >= chunkSize) {
        processedInChunk = 0
        await yieldToBrowser()
      }
    }
  }

  return buildStatsResult(index, start, totalInserted, collisions, overflowedHomeBuckets)
}

export const searchKeyInIndex = (
  key: string,
  pages: Page[],
  index: HashIndex,
  strategy: HashFunctionName = 'djb2'
): IndexSearchResult => {
  const start = performance.now()
  const visitedBuckets: number[] = []
  const homeBucketId = hashKeyToBucket(key, index.nb, strategy)

  for (let offset = 0; offset < index.nb; offset += 1) {
    const bucketId = (homeBucketId + offset) % index.nb
    const bucket = index.buckets[bucketId]
    visitedBuckets.push(bucketId)

    const hit = bucket.entries.find((entry) => entry.key === key)
    if (hit) {
      const page = pages[hit.pageNumber - 1]
      const foundInPage = Boolean(page?.records.includes(key))
      const end = performance.now()

      return {
        found: foundInPage,
        key,
        pageNumber: foundInPage ? hit.pageNumber : undefined,
        bucketsProbed: visitedBuckets.length,
        costEstimatePages: visitedBuckets.length + (foundInPage ? 1 : 0),
        visitedBuckets,
        timeMs: end - start,
      }
    }

    if (bucket.entries.length < bucket.capacity) {
      const end = performance.now()
      return {
        found: false,
        key,
        bucketsProbed: visitedBuckets.length,
        costEstimatePages: visitedBuckets.length,
        visitedBuckets,
        timeMs: end - start,
      }
    }
  }

  const end = performance.now()
  return {
    found: false,
    key,
    bucketsProbed: visitedBuckets.length,
    costEstimatePages: visitedBuckets.length,
    visitedBuckets,
    timeMs: end - start,
  }
}

export const tableScanSearch = (key: string, pages: Page[]): TableScanResult => {
  const start = performance.now()
  const scannedPages: Array<{ pageNumber: number; recordsRead: string[] }> = []

  for (const page of pages) {
    scannedPages.push({ pageNumber: page.pageNumber, recordsRead: page.records })

    if (page.records.includes(key)) {
      const end = performance.now()
      return {
        found: true,
        key,
        pageNumber: page.pageNumber,
        pagesRead: scannedPages.length,
        costEstimatePages: scannedPages.length,
        scannedPages,
        timeMs: end - start,
      }
    }
  }

  const end = performance.now()
  return {
    found: false,
    key,
    pagesRead: scannedPages.length,
    costEstimatePages: scannedPages.length,
    scannedPages,
    timeMs: end - start,
  }
}

export const tableScanSearchAsync = async (
  key: string,
  pages: Page[],
  chunkSize = 200
): Promise<TableScanResult> => {
  const start = performance.now()
  const scannedPages: Array<{ pageNumber: number; recordsRead: string[] }> = []
  let processedInChunk = 0

  for (const page of pages) {
    scannedPages.push({ pageNumber: page.pageNumber, recordsRead: page.records })

    if (page.records.includes(key)) {
      const end = performance.now()
      return {
        found: true,
        key,
        pageNumber: page.pageNumber,
        pagesRead: scannedPages.length,
        costEstimatePages: scannedPages.length,
        scannedPages,
        timeMs: end - start,
      }
    }

    processedInChunk += 1
    if (processedInChunk >= chunkSize) {
      processedInChunk = 0
      await yieldToBrowser()
    }
  }

  const end = performance.now()
  return {
    found: false,
    key,
    pagesRead: scannedPages.length,
    costEstimatePages: scannedPages.length,
    scannedPages,
    timeMs: end - start,
  }
}
