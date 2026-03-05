export type BucketEntry = {
  key: string
  pageNumber: number
  homeBucketId: number
  bucketId: number
  isOverflow: boolean
}

export type Bucket = {
  id: number
  capacity: number
  entries: BucketEntry[]
}

export type HashIndex = {
  fr: number
  nb: number
  buckets: Bucket[]
}

export type HashFunctionName = 'djb2' | 'charCodeSum'

export type HashBuildStats = {
  totalInserted: number
  collisions: number
  collisionsRate: number
  overflowedBuckets: number
  overflowRate: number
  buildTimeMs: number
}

export type HashBuildResult = {
  index: HashIndex
  stats: HashBuildStats
}
