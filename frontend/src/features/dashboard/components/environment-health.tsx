import { CircleCheck, CircleX, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardData } from '../api'

export function EnvironmentHealth({
  environments,
  isLoading,
}: {
  environments: DashboardData['environmentHealth']
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className='space-y-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='flex items-center gap-4'>
            <Skeleton className='h-9 w-9 rounded-full' />
            <div className='flex-1 space-y-1'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-3 w-20' />
            </div>
            <Skeleton className='h-4 w-16' />
          </div>
        ))}
      </div>
    )
  }

  if (environments.length === 0) {
    return (
      <div className='flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground'>
        <Server className='h-8 w-8' />
        <p className='text-sm'>No environments registered.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {environments.map((environment) => (
        <div key={environment.environmentId} className='flex items-center gap-4'>
          <div
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full border'
            title={environment.connected ? 'Connected' : 'Unreachable'}
          >
            {environment.connected ? (
              <CircleCheck className='h-5 w-5 text-emerald-500' />
            ) : (
              <CircleX className='h-5 w-5 text-destructive' />
            )}
          </div>
          <div className='flex flex-1 flex-wrap items-center justify-between gap-2'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <p className='text-sm leading-none font-medium'>
                  {environment.name}
                </p>
                {!environment.isActive && (
                  <Badge variant='secondary'>inactive</Badge>
                )}
              </div>
              <p className='text-sm text-muted-foreground'>
                {environment.tenantCount} tenant
                {environment.tenantCount === 1 ? '' : 's'}
                {environment.connected
                  ? ` · ${environment.latencyMs ?? '-'} ms`
                  : ' · unreachable'}
              </p>
            </div>
            <Badge
              variant={environment.connected ? 'default' : 'destructive'}
            >
              {environment.connected ? 'reachable' : 'offline'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
