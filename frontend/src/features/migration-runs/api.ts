import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, type ApiResponse } from '@/lib/api'

export interface MigrationRun {
  id: string
  source_env_id: string
  target_env_id: string
  source_tenant_code: string
  target_tenant_code: string
  tenant_schema: string
  overwrite_confirmed: boolean
  status: 'running' | 'succeeded' | 'failed'
  dump_file_path: string | null
  row_counts: Record<string, number> | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  source_env: { id: string; name: string } | null
  target_env: { id: string; name: string } | null
}

export interface TriggerMigrationRunInput {
  source_env_id: string
  source_tenant_code: string
  target_env_id: string
  target_tenant_code: string
  confirm_overwrite?: boolean
}

export function useMigrationRuns() {
  return useQuery({
    queryKey: ['migration-runs'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MigrationRun[]>>('/migrations')
      return data.data
    },
  })
}

export function useTriggerMigrationRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TriggerMigrationRunInput) => {
      const { data } = await apiClient.post<ApiResponse<MigrationRun>>('/migrations', payload)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-runs'] })
    },
  })
}