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
        `${ENDPOINT}/${id}`
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
        payload
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
        payload
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

export interface ConnectionTestResult {
  connected: boolean
  latencyMs: number | null
  error?: string
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get<ApiResponse<ConnectionTestResult>>(
        `${ENDPOINT}/${id}/test-connection`
      )
      return data.data
    },
  })
}

// Probes a candidate connection without persisting an environment record. Used
// to validate credentials before creating an environment.
export function useTestConnectionCredentials() {
  return useMutation({
    mutationFn: async (payload: {
      host: string
      port: number
      db: string
      user: string
      password?: string
      ssl_mode: string
    }) => {
      const { data } = await apiClient.post<ApiResponse<ConnectionTestResult>>(
        `${ENDPOINT}/test-connection`,
        payload
      )
      return data.data
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
      queryClient.invalidateQueries({ queryKey: ['environments', 'health'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export interface EnvironmentHealth {
  environmentId: string
  name: string
  isActive: boolean
  connected: boolean
  latencyMs: number | null
}

export function useEnvironmentHealth() {
  return useQuery({
    queryKey: ['environments', 'health'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EnvironmentHealth[]>>(
        `${ENDPOINT}/health`
      )
      return data.data
    },
  })
}
