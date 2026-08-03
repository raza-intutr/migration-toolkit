import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardData } from '../api'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

export function RecentTenants({
  tenants,
  isLoading,
}: {
  tenants: DashboardData['recentTenants']
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className='space-y-8'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='flex items-center gap-4'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1 space-y-1'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-3 w-24' />
            </div>
            <Skeleton className='h-4 w-16' />
          </div>
        ))}
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className='flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground'>
        <p className='text-sm'>No tenants found.</p>
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {tenants.map((tenant) => (
        <div key={tenant.id} className='flex items-center gap-4'>
          <Avatar className='h-9 w-9'>
            <AvatarFallback>{initials(tenant.tenantName)}</AvatarFallback>
          </Avatar>
          <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
            <div className='space-y-1'>
              <p className='text-sm leading-none font-medium'>
                {tenant.tenantName}
              </p>
              <p className='text-sm text-muted-foreground'>
                {tenant.tenantCode} · {tenant.environmentName}
              </p>
            </div>
            <Badge variant={tenant.tenantType === 'B2B' ? 'default' : 'secondary'}>
              {tenant.tenantType}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
