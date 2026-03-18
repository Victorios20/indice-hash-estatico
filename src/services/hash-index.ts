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
  const minimumByRule = Math.floor(nr / fr) + 1
  const targetLoadFactor = 0.75
  const recommendedByLoadFactor = Math.ceil(nr / (fr * targetLoadFactor))
  return Math.max(minimumByRule, recommendedByLoadFactor)
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

class FenwickTree {
  private readonly tree: number[]

  constructor(size: number) {
    this.tree = Array.from({ length: size + 1 }, () => 0)
  }

  static withAllOnes(size: number): FenwickTree {
    const fenwick = new FenwickTree(size)

    for (let i = 1; i < fenwick.tree.length; i += 1) {
      fenwick.tree[i] = 1
    }

    for (let i = 1; i < fenwick.tree.length; i += 1) {
      const parent = i + (i & -i)
      if (parent < fenwick.tree.length) {
        fenwick.tree[parent] += fenwick.tree[i]
      }
    }

    return fenwick
  }

  add(index: number, delta: number) {
    for (let i = index + 1; i < this.tree.length; i += i & -i) {
      this.tree[i] += delta
    }
  }

  prefixSum(index: number): number {
    let sum = 0
    for (let i = index + 1; i > 0; i -= i & -i) {
      sum += this.tree[i]
    }
    return sum
  }

  // Finds first index whose prefix sum is >= target (target starts at 1).
  lowerBound(target: number): number {
    let idx = 0
    let bit = 1

    while ((bit << 1) < this.tree.length) bit <<= 1

    let running = 0
    while (bit > 0) {
      const next = idx + bit
      if (next < this.tree.length && running + this.tree[next] < target) {
        running += this.tree[next]
        idx = next
      }
      bit >>= 1
    }

    return idx
  }
}

const createBucketAvailabilityTree = (nb: number): FenwickTree => {
  return FenwickTree.withAllOnes(nb)
}

const findBucketForInsertFast = (
  startBucketId: number,
  availability: FenwickTree,
  availableBuckets: number
): number => {
  if (availableBuckets <= 0) return -1

  const prefixBeforeStart = startBucketId > 0 ? availability.prefixSum(startBucketId - 1) : 0
  const availableFromStart = availableBuckets - prefixBeforeStart

  if (availableFromStart > 0) {
    return availability.lowerBound(prefixBeforeStart + 1)
  }

  return availability.lowerBound(1)
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

export const buildIndexFromPages = ( //constrói o indice a partir das paginas
  pages: Page[],
  fr: number,
  nb: number,
  strategy: HashFunctionName = 'djb2'
): HashBuildResult => {
  const start = performance.now()
  const index = createEmptyIndex(0, fr, nb)
  const availability = createBucketAvailabilityTree(nb)
  let availableBuckets = nb

  let collisions = 0
  let totalInserted = 0
  const overflowedHomeBuckets = new Set<number>()

  for (const page of pages) {
    for (const key of page.records) {
      const homeBucketId = hashKeyToBucket(key, nb, strategy)
      const homeBucket = index.buckets[homeBucketId]

      const homeIsFull = homeBucket.entries.length >= homeBucket.capacity
      if (homeIsFull) {
        collisions += 1 //contagem de colisão 
        overflowedHomeBuckets.add(homeBucketId)
      }

      const targetBucketId = findBucketForInsertFast(homeBucketId, availability, availableBuckets)
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
      if (index.buckets[targetBucketId].entries.length === index.buckets[targetBucketId].capacity) {
        availability.add(targetBucketId, -1)
        availableBuckets -= 1
      }
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
  const index = createEmptyIndex(0, fr, nb) //Cria o indice vazio
  const availability = createBucketAvailabilityTree(nb)
  let availableBuckets = nb

  let collisions = 0
  let totalInserted = 0
  let processedInChunk = 0
  const overflowedHomeBuckets = new Set<number>()

  for (const page of pages) {
    for (const key of page.records) {
      const homeBucketId = hashKeyToBucket(key, nb, strategy) //descobre o bucket da palavra 
      const homeBucket = index.buckets[homeBucketId]

      const homeIsFull = homeBucket.entries.length >= homeBucket.capacity //verifica se o homebucket esta cheio e bucket overflow
      if (homeIsFull) {
        collisions += 1
        overflowedHomeBuckets.add(homeBucketId)
      }

      const targetBucketId = findBucketForInsertFast(homeBucketId, availability, availableBuckets)
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

      index.buckets[targetBucketId].entries.push(entry) //insere a palavra no bucket encontrado
      if (index.buckets[targetBucketId].entries.length === index.buckets[targetBucketId].capacity) {
        availability.add(targetBucketId, -1)
        availableBuckets -= 1
      }
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

export const searchKeyInIndex = ( //pesquisa a palavra/chave no indice
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
    visitedBuckets.push(bucketId) //contagem de buckets visitados

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
        costEstimatePages: foundInPage ? 1 : 0,
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
        costEstimatePages: 0,
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
    costEstimatePages: 0,
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
