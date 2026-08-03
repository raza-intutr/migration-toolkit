import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiResponse } from '@/lib/api'

export interface Environment {
  id: string
  name: string
  host: string
  port: number
  db: string
  user: string
  password: string | null
  ssl_mode: string
  is_active: boolean
  ismultitenant: boolean
  created_at: string
  updated_at: string
}

export type EnvironmentInput = {
  name: string
  host: string
  port: number
  db: string
  user: string
  password?: string | null
  ssl_mode: string
  is_active: boolean
  ismultitenant: boolean
}

const ENDPOINT = '/environments'

export function useEnvironments() {
  return useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Environment[]>>(ENDPOINT)
      return data.data
    },
  })
}

export function useEnvironment(id: string | undefined) {
  return useQuery({
    queryKey: ['environments', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Environment>>(
        `${ENDPOINT}/${id}`,
      )
      return data.data
    },
  })
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EnvironmentInput) => {
      const { data } = await apiClient.post<ApiResponse<Environment>>(
        ENDPOINT,
        payload,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateEnvironment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<EnvironmentInput>) => {
      const { data } = await apiClient.patch<ApiResponse<Environment>>(
        `${ENDPOINT}/${id}`,
        payload,
      )
      return data.data
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.setQueryData(['environments', id], updated)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINT}/${id}`)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
