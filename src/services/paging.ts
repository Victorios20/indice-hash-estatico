import type { Page } from '@/domain/page'

export const buildPages = (records: string[], pageSize: number): Page[] => {
  const pages: Page[] = []

  if (pageSize <= 0) return pages

  let pageNumber = 1
  for (let i = 0; i < records.length; i += pageSize) {
    const slice = records.slice(i, i + pageSize)
    pages.push({ pageNumber, records: slice })
    pageNumber += 1
  }

  return pages
}

const yieldToBrowser = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export const buildPagesAsync = async (
  records: string[],
  pageSize: number,
  chunkSize = 5000
): Promise<Page[]> => {
  const pages: Page[] = []
  if (pageSize <= 0) return pages

  let pageNumber = 1
  let processedInChunk = 0

  for (let i = 0; i < records.length; i += pageSize) {
    const slice = records.slice(i, i + pageSize)
    pages.push({ pageNumber, records: slice })
    pageNumber += 1

    processedInChunk += slice.length
    if (processedInChunk >= chunkSize) {
      processedInChunk = 0
      await yieldToBrowser()
    }
  }

  return pages
}
