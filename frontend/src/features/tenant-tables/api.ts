import { useQuery } from '@tanstack/react-query'
import { apiClient, type ApiResponse } from '@/lib/api'

const ENDPOINT = '/environments'

export interface TenantInfo {
  id: string
  tenant_id: string
  tenant_code: string
  tenant_name: string
  tenant_type: 'B2B' | 'B2C'
  active: boolean
}

export interface TableInfo {
  schema: string
  name: string
  qualified: string
  estimatedRows: string
}

export function useEnvironmentTenants(environmentId: string | undefined) {
  return useQuery({
    queryKey: ['environments', environmentId, 'tenants'],
    enabled: Boolean(environmentId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TenantInfo[]>>(
        `${ENDPOINT}/${environmentId}/tenants`
      )
      return data.data
    },
  })
}

export function useTenantTables(
  environmentId: string | undefined,
  tenantCode: string | undefined
) {
  return useQuery({
    queryKey: ['environments', environmentId, 'tenants', tenantCode, 'tables'],
    enabled: Boolean(environmentId) && Boolean(tenantCode),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TableInfo[]>>(
        `${ENDPOINT}/${environmentId}/tenants/${tenantCode}/tables`
      )
      return data.data
    },
  })
}
