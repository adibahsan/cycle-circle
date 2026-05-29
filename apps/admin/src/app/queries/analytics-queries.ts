import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import {
  getCycleLengthDistribution as svcGetCycleLengthDistribution,
  getSymptomsByCategory as svcGetSymptomsByCategory,
  getPredictionAccuracy as svcGetPredictionAccuracy,
  getUserRetention as svcGetUserRetention,
} from '@vesta/shared/server/services'

export const getCycleLengthDistribution = cache(async () => {
  await requireAdminUser()
  return svcGetCycleLengthDistribution()
})

export const getSymptomsByCategory = cache(async () => {
  await requireAdminUser()
  return svcGetSymptomsByCategory()
})

export const getPredictionAccuracy = cache(async () => {
  await requireAdminUser()
  return svcGetPredictionAccuracy()
})

export const getUserRetention = cache(async () => {
  await requireAdminUser()
  return svcGetUserRetention()
})
