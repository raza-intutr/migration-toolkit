import { useQuery } from '@tanstack/react-query'
import { apiClient, type ApiResponse } from '@/lib/api'

export type TenantType = 'B2B' | 'B2C'

export interface DashboardData {
  environments: {
    total: number
    active: number
  }
  tenants: {
    total: number
    b2b: number
    b2c: number
  }
  health: {
    connected: number
    unreachable: number
  }
  tenantsByEnvironment: {
    environmentId: string
    name: string
    tenantCount: number
  }[]
  environmentHealth: {
    environmentId: string
    name: string
    isActive: boolean
    tenantCount: number
    connected: boolean
    latencyMs: number | null
  }[]
  recentTenants: {
    id: string
    tenantCode: string
    tenantName: string
    tenantType: TenantType
    createdAt: string
    environmentName: string
  }[]
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DashboardData>>('/dashboard')
      return data.data
    },
  })
}
