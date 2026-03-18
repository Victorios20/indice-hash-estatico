import type { Page } from '@/domain/page'

const calculateTotalPages = (recordsLength: number, pageSize: number): number => {
  if (pageSize <= 0 || recordsLength <= 0) return 0
  return Math.ceil(recordsLength / pageSize)
}

const createEmptyPages = (totalPages: number): Page[] => {
  return Array.from({ length: totalPages }, (_, index) => ({
    pageNumber: index + 1,
    records: [],
  }))
}

export const buildPages = (records: string[], pageSize: number): Page[] => {
  const totalPages = calculateTotalPages(records.length, pageSize)
  const pages = createEmptyPages(totalPages)

  if (totalPages === 0) return pages

  for (let i = 0; i < records.length; i += 1) {
    const pageIndex = Math.floor(i / pageSize)
    pages[pageIndex].records.push(records[i])
  }

  return pages
}

const yieldToBrowser = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export const buildPagesAsync = async ( //preenchimento das tabelas
  records: string[],
  pageSize: number,
  chunkSize = 5000
): Promise<Page[]> => {
  const totalPages = calculateTotalPages(records.length, pageSize)
  const pages = createEmptyPages(totalPages)

  if (totalPages === 0) return pages

  let processedInChunk = 0

  for (let i = 0; i < records.length; i += 1) {
    const pageIndex = Math.floor(i / pageSize)
    pages[pageIndex].records.push(records[i])

    processedInChunk += 1
    if (processedInChunk >= chunkSize) {
      processedInChunk = 0
      await yieldToBrowser()
    }
  }

  return pages
}
