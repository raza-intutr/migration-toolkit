import { useState } from 'react'
import {
  CircleCheck,
  CircleX,
  Database,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useEnvironments } from '@/features/environments/api'
import {
  useEnvironmentTenants,
} from '@/features/tenant-tables/api'
import {
  useMigrationRuns,
  useTriggerMigrationRun,
  type MigrationRun,
} from './api'

const statusBadge = (status: MigrationRun['status']) => {
  if (status === 'succeeded')
    return (
      <Badge variant='default'>
        <CircleCheck className='h-3 w-3' /> Succeeded
      </Badge>
    )
  if (status === 'failed')
    return (
      <Badge variant='destructive'>
        <CircleX className='h-3 w-3' /> Failed
      </Badge>
    )
  return (
    <Badge variant='secondary'>
      <Loader2 className='h-3 w-3 animate-spin' /> Running
    </Badge>
  )
}

export function MigrationRunsPage() {
  const { data: environments, isLoading: environmentsLoading } =
    useEnvironments()
  const runsQuery = useMigrationRuns()
  const triggerMutation = useTriggerMigrationRun()

  const [sourceEnvId, setSourceEnvId] = useState<string>()
  const [targetEnvId, setTargetEnvId] = useState<string>()
  const [sourceTenant, setSourceTenant] = useState<string>()
  const [targetTenant, setTargetTenant] = useState<string>()
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const sourceTenants = useEnvironmentTenants(sourceEnvId)
  const targetTenants = useEnvironmentTenants(targetEnvId)

  const refresh = () => runsQuery.refetch()

  const submit = async () => {
    if (!sourceEnvId || !targetEnvId || !sourceTenant || !targetTenant) {
      toast.error('Pick source/target environment and tenant first.')
      return
    }
    try {
      const run = await triggerMutation.mutateAsync({
        source_env_id: sourceEnvId,
        source_tenant_code: sourceTenant,
        target_env_id: targetEnvId,
        target_tenant_code: targetTenant,
        confirm_overwrite: confirmOverwrite,
      })
      toast.success(`Migration run started (${run.id.slice(0, 8)}…)`)
      refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Migration failed')
    }
  }

  return (
    <div className='space-y-4'>
      {/* Trigger form */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <PlayCircle className='h-4 w-4' />
            pg_dump migration
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Migrates a tenant database from a source environment into a target
            environment using pg_dump → pg_restore. Runs asynchronously.
          </p>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Environments */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Source environment
              </label>
              <Select
                value={sourceEnvId ?? ''}
                onValueChange={(v) => {
                  setSourceEnvId(v || undefined)
                  setSourceTenant(undefined)
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={
                      environmentsLoading ? 'Loading…' : 'Select environment'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {environments?.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Target environment
              </label>
              <Select
                value={targetEnvId ?? ''}
                onValueChange={(v) => {
                  setTargetEnvId(v || undefined)
                  setTargetTenant(undefined)
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={
                      environmentsLoading ? 'Loading…' : 'Select environment'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {environments?.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tenants */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Source tenant
              </label>
              <Select
                value={sourceTenant ?? ''}
                onValueChange={(v) => setSourceTenant(v || undefined)}
                disabled={!sourceEnvId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={sourceEnvId ? 'Select tenant' : 'Pick env first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sourceTenants.data?.map((t) => (
                    <SelectItem key={t.tenant_code} value={t.tenant_code}>
                      {t.tenant_code} · {t.tenant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Target tenant
              </label>
              <Select
                value={targetTenant ?? ''}
                onValueChange={(v) => setTargetTenant(v || undefined)}
                disabled={!targetEnvId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={targetEnvId ? 'Select tenant' : 'Pick env first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetTenants.data?.map((t) => (
                    <SelectItem key={t.tenant_code} value={t.tenant_code}>
                      {t.tenant_code} · {t.tenant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overwrite */}
          <label className='flex cursor-pointer items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm'>
            <input
              type='checkbox'
              className='h-4 w-4 accent-primary'
              checked={confirmOverwrite}
              onChange={(e) => setConfirmOverwrite(e.target.checked)}
            />
            Confirm overwrite — allowed even if target has data
          </label>

          {/* Actions */}
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs text-muted-foreground'>
              The target tenant database is fully replaced by the source dump.
            </p>
            <Button
              type='button'
              disabled={triggerMutation.isPending}
              onClick={submit}
            >
              {triggerMutation.isPending ? (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              ) : (
                <PlayCircle className='mr-1 h-4 w-4' />
              )}
              Start migration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Runs list */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <CardTitle className='flex items-center gap-2'>
            <Database className='h-4 w-4' />
            Migration runs
          </CardTitle>
          <Button type='button' variant='outline' size='sm' onClick={refresh}>
            <RefreshCw className='mr-1 h-3 w-3' />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : runsQuery.data && runsQuery.data.length > 0 ? (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-left'>
                  <tr>
                    <th className='px-4 py-3 font-medium text-muted-foreground'>
                      Source
                    </th>
                    <th className='px-4 py-3 font-medium text-muted-foreground'>
                      Target
                    </th>
                    <th className='px-4 py-3 font-medium text-muted-foreground'>
                      Status
                    </th>
                    <th className='px-4 py-3 font-medium text-muted-foreground'>
                      Rows
                    </th>
                    <th className='px-4 py-3 font-medium text-muted-foreground'>
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runsQuery.data.map((run) => (
                    <tr
                      key={run.id}
                      className='border-t transition-colors hover:bg-muted/30'
                    >
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <Badge variant='secondary'>
                            {run.source_env?.name ?? run.source_env_id}
                          </Badge>
                          <span className='text-muted-foreground'>/</span>
                          <span className='font-medium'>
                            {run.source_tenant_code}
                          </span>
                        </div>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <Badge variant='secondary'>
                            {run.target_env?.name ?? run.target_env_id}
                          </Badge>
                          <span className='text-muted-foreground'>/</span>
                          <span className='font-medium'>
                            {run.target_tenant_code}
                          </span>
                        </div>
                      </td>
                      <td className='px-4 py-3'>{statusBadge(run.status)}</td>
                      <td className='px-4 py-3'>
                        {run.row_counts
                          ? `${Object.keys(run.row_counts).length} tables`
                          : run.status === 'failed'
                            ? '—'
                            : <Loader2 className='h-3 w-3 animate-spin' />}
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className='flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground'>
              <ShieldAlert className='h-4 w-4' />
              No migration runs yet. Start one above.
            </div>
          )}

          {/* Failed run detail */}
          {runsQuery.data?.some((r) => r.status === 'failed') && (
            <div className='mt-4 space-y-2'>
              {runsQuery.data
                .filter((r) => r.status === 'failed' && r.error_message)
                .map((r) => (
                  <div
                    key={r.id}
                    className='rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700'
                  >
                    <span className='font-medium'>Run {r.id.slice(0, 8)}:</span>{' '}
                    {r.error_message}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}