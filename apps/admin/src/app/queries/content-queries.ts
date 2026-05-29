import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listArticles, getArticleById, listCategories } from '@vesta/shared/server/services'

export const getArticles = cache(async (params: {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: string
} = {}) => {
  await requireAdminUser()
  return listArticles(params)
})

export const getArticle = cache(async (id: string) => {
  await requireAdminUser()
  return getArticleById(id)
})

export const getCategories = cache(async () => {
  await requireAdminUser()
  return listCategories()
})
