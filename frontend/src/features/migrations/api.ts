import { useMutation, useQuery } from '@tanstack/react-query'
import { apiClient, type ApiResponse } from '@/lib/api'

export interface MigrationTableRow {
  table: string
  rows: number
}

export interface MigrationResult {
  source: string
  destination: string
  dryRun: boolean
  tables: MigrationTableRow[]
  totalRows: number
  resolvedTables: string[]
}

export interface SameEnvMigrationInput {
  sourceTenantCode: string
  destinationTenantCode: string
  tables?: string[]
  truncateFirst?: boolean
  onConflictSkip?: boolean
  dryRun: boolean
}

export interface CrossEnvMigrationInput {
  sourceEnvironmentId: string
  destinationEnvironmentId?: string
  sourceTenantCode: string
  destinationTenantCode: string
  tables?: string[]
  truncateFirst?: boolean
  onConflictSkip?: boolean
  dryRun: boolean
}

export function useMigrateTenant(environmentId: string | undefined) {
  return useMutation({
    mutationFn: async (payload: SameEnvMigrationInput) => {
      const { data } = await apiClient.post<ApiResponse<MigrationResult>>(
        `/environments/${environmentId}/migrations`,
        payload
      )
      return data.data
    },
  })
}

export function useMigrateCrossEnvironment() {
  return useMutation({
    mutationFn: async (payload: CrossEnvMigrationInput) => {
      const { data } = await apiClient.post<ApiResponse<MigrationResult>>(
        '/migrations/cross-environment',
        payload
      )
      return data.data
    },
  })
}

export interface MigrationTableInfo {
  schema: string
  name: string
  qualified: string
  estimatedRows: string
}

export function useMigrationSourceTables(
  environmentId: string | undefined,
  tenantCode: string | undefined
) {
  return useQuery({
    queryKey: [
      'environments',
      environmentId,
      'tenants',
      tenantCode,
      'tables',
      'migration',
    ],
    enabled: Boolean(environmentId) && Boolean(tenantCode),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<MigrationTableInfo[]>>(
        `/environments/${environmentId}/tenants/${tenantCode}/tables`
      )
      return data.data
    },
  })
}

export interface TruncateResult {
  tenant: string
  dryRun: false
  tables: { table: string }[]
  truncatedCount: number
}

export function useTruncateTenant(environmentId: string | undefined) {
  return useMutation({
    mutationFn: async (payload: { tenantCode: string; tables?: string[] }) => {
      const { data } = await apiClient.post<ApiResponse<TruncateResult>>(
        `/environments/${environmentId}/tenants/${payload.tenantCode}/truncate`,
        payload
      )
      return data.data
    },
  })
}
