import type { Page } from '@/domain/page'
import type {
  Bucket,
  BucketEntry,
  HashBuildResult,
  HashFunctionName,
  HashIndex,
} from '@/domain/hash-index'

export type { HashFunctionName } from '@/domain/hash-index'

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

  for (const page of pages) {
    for (const key of page.records) {
      const homeBucketId = hashKeyToBucket(key, nb, strategy)
      const homeBucket = index.buckets[homeBucketId]

      // Regra do projeto (HU07): conta colisão só quando o bucket de origem está cheio.
      if (homeBucket.entries.length >= homeBucket.capacity) {
        collisions += 1
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
      }

      index.buckets[targetBucketId].entries.push(entry)
      totalInserted += 1
    }
  }

  const end = performance.now()
  const collisionsRate = totalInserted === 0 ? 0 : (collisions / totalInserted) * 100

  return {
    index,
    stats: {
      totalInserted,
      collisions,
      collisionsRate,
      buildTimeMs: end - start,
    },
  }
}
