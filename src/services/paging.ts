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