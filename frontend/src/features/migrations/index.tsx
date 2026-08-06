import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Database,
  Eye,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEnvironments, type Environment } from '@/features/environments/api'
import {
  useEnvironmentTenants,
  type TenantInfo,
} from '@/features/tenant-tables/api'
import {
  useMigrateCrossEnvironment,
  useMigrateTenant,
  useMigrationSourceTables,
  useTruncateTenant,
  type MigrationResult,
  type TruncateResult,
} from './api'

type Mode = 'same' | 'cross'

export function MigrationsPage() {
  const { data: environments, isLoading: environmentsLoading } =
    useEnvironments()

  const [mode, setMode] = useState<Mode>('same')

  // Same-env mode reuses the source environment for destination.
  const [sameEnvId, setSameEnvId] = useState<string | undefined>()

  // Cross-env mode has two independent environment pickers.
  const [sourceEnvId, setSourceEnvId] = useState<string | undefined>()
  const [destEnvId, setDestEnvId] = useState<string | undefined>()

  const [sourceTenant, setSourceTenant] = useState<string | undefined>()
  const [destTenant, setDestTenant] = useState<string | undefined>()

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [truncateFirst, setTruncateFirst] = useState(true)
  const [onConflictSkip, setOnConflictSkip] = useState(true)
  const [result, setResult] = useState<MigrationResult | null>(null)

  // Truncate state
  const [truncateEnvId, setTruncateEnvId] = useState<string | undefined>()
  const [truncateTenant, setTruncateTenant] = useState<string | undefined>()
  const [truncateSelectedTables, setTruncateSelectedTables] = useState<
    Set<string>
  >(new Set())
  const [truncateResult, setTruncateResult] = useState<TruncateResult | null>(
    null
  )

  // Resolve the effective environment ids based on the active mode. Keeps the
  // downstream query hooks simple — they only need to know "which env id".
  const effectiveSourceEnvId = mode === 'same' ? sameEnvId : sourceEnvId
  const effectiveDestEnvId = mode === 'same' ? sameEnvId : destEnvId

  const sourceTenants = useEnvironmentTenants(effectiveSourceEnvId)
  const destTenants = useEnvironmentTenants(effectiveDestEnvId)

  const sourceTables = useMigrationSourceTables(
    effectiveSourceEnvId,
    sourceTenant
  )

  const truncateTenants = useEnvironmentTenants(truncateEnvId)
  const truncateTables = useMigrationSourceTables(truncateEnvId, truncateTenant)

  const migrateSame = useMigrateTenant(mode === 'same' ? sameEnvId : undefined)
  const migrateCross = useMigrateCrossEnvironment()
  const truncateMutation = useTruncateTenant(truncateEnvId)

  const migration = mode === 'same' ? migrateSame : migrateCross

  // Reset tenant selections when the source env changes — old tenants
  // probably don't exist in the new env.
  const handleSourceEnvChange = (value: string | undefined) => {
    if (mode === 'same') {
      setSameEnvId(value)
    } else {
      setSourceEnvId(value)
    }
    setSourceTenant(undefined)
    setDestTenant(undefined)
    setSelectedTables(new Set())
  }

  const handleDestEnvChange = (value: string | undefined) => {
    if (mode === 'cross') {
      setDestEnvId(value)
      setDestTenant(undefined)
    }
  }

  const handleTruncateEnvChange = (value: string | undefined) => {
    setTruncateEnvId(value)
    setTruncateTenant(undefined)
    setTruncateSelectedTables(new Set())
    setTruncateResult(null)
  }

  const handleTruncateTenantChange = (value: string | undefined) => {
    setTruncateTenant(value)
    setTruncateSelectedTables(new Set())
    setTruncateResult(null)
  }

  const handleModeChange = (next: Mode) => {
    setMode(next)
    setResult(null)
    setSelectedTables(new Set())
  }

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleAllTables = () => {
    if (!sourceTables.data) return
    const allNames = sourceTables.data.map((t) => t.name)
    const allSelected = allNames.every((n) => selectedTables.has(n))
    if (allSelected) {
      setSelectedTables(new Set())
    } else {
      setSelectedTables(new Set(allNames))
    }
  }

  // Build the request payload + dispatch. dryRun parameter controls whether
  // the request actually writes.
  const submit = async (dryRun: boolean) => {
    if (
      !effectiveSourceEnvId ||
      !effectiveDestEnvId ||
      !sourceTenant ||
      !destTenant
    ) {
      toast.error('Pick source/destination environment and tenant first.')
      return
    }
    if (sourceTenant === destTenant) {
      toast.error('Source and destination tenants must differ.')
      return
    }
    const tablesFilter =
      selectedTables.size > 0 ? Array.from(selectedTables) : undefined

    try {
      let outcome: MigrationResult
      if (mode === 'same') {
        outcome = await migrateSame.mutateAsync({
          sourceTenantCode: sourceTenant,
          destinationTenantCode: destTenant,
          tables: tablesFilter,
          truncateFirst,
          onConflictSkip,
          dryRun,
        })
      } else {
        outcome = await migrateCross.mutateAsync({
          sourceEnvironmentId: effectiveSourceEnvId,
          destinationEnvironmentId:
            effectiveDestEnvId === effectiveSourceEnvId
              ? undefined
              : effectiveDestEnvId,
          sourceTenantCode: sourceTenant,
          destinationTenantCode: destTenant,
          tables: tablesFilter,
          truncateFirst,
          onConflictSkip,
          dryRun,
        })
      }
      setResult(outcome)
      toast.success(
        dryRun
          ? `Dry-run complete · ${outcome.totalRows.toLocaleString()} rows across ${outcome.tables.length} tables`
          : `Migration complete · ${outcome.totalRows.toLocaleString()} rows copied`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Migration failed')
    }
  }

  const environmentLabel = (envs: Environment[] | undefined, id?: string) =>
    envs?.find((e) => e.id === id)?.name ?? id

  const tenantLabel = (tenants: TenantInfo[] | undefined, code?: string) =>
    tenants?.find((t) => t.tenant_code === code)?.tenant_name ?? code

  const sourceEnvName = environmentLabel(environments, effectiveSourceEnvId)
  const destEnvName = environmentLabel(environments, effectiveDestEnvId)
  const sourceTenantName = tenantLabel(sourceTenants.data, sourceTenant)
  const destTenantName = tenantLabel(destTenants.data, destTenant)

  const resultColumns = useMemo<ColumnDef<MigrationResult['tables'][number]>[]>(
    () => [
      {
        header: 'Table',
        accessorKey: 'table',
        cell: ({ row }) => (
          <code className='text-xs'>{row.original.table}</code>
        ),
      },
      {
        header: 'Rows',
        accessorKey: 'rows',
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.rows.toLocaleString()}
          </span>
        ),
      },
    ],
    []
  )

  const resultTable = useReactTable({
    data: result?.tables ?? [],
    columns: resultColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex flex-row items-center justify-between space-y-0'>
            <CardTitle>Tenant data migration</CardTitle>
            <Tabs
              value={mode}
              onValueChange={(v) => handleModeChange(v as Mode)}
            >
              <TabsList>
                <TabsTrigger value='same'>Same environment</TabsTrigger>
                <TabsTrigger value='cross'>Cross environment</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Environment pickers */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Source environment
              </label>
              <Select
                value={
                  mode === 'same' ? (sameEnvId ?? '') : (sourceEnvId ?? '')
                }
                onValueChange={(v) => handleSourceEnvChange(v || undefined)}
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
                Destination environment
              </label>
              {mode === 'same' ? (
                <div className='flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground'>
                  Same as source
                </div>
              ) : (
                <Select
                  value={destEnvId ?? ''}
                  onValueChange={(v) => handleDestEnvChange(v || undefined)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select environment' />
                  </SelectTrigger>
                  <SelectContent>
                    {environments?.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Tenant pickers */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm leading-none font-medium'>
                Source tenant
              </label>
              <Select
                value={sourceTenant ?? ''}
                onValueChange={(v) => {
                  setSourceTenant(v || undefined)
                  setSelectedTables(new Set())
                }}
                disabled={!effectiveSourceEnvId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={
                      effectiveSourceEnvId ? 'Select tenant' : 'Pick env first'
                    }
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
                Destination tenant
              </label>
              <Select
                value={destTenant ?? ''}
                onValueChange={(v) => setDestTenant(v || undefined)}
                disabled={!effectiveDestEnvId}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={
                      effectiveDestEnvId ? 'Select tenant' : 'Pick env first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destTenants.data?.map((t) => (
                    <SelectItem key={t.tenant_code} value={t.tenant_code}>
                      {t.tenant_code} · {t.tenant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary breadcrumb */}
          <div className='flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm'>
            <Badge variant='secondary'>{sourceEnvName ?? 'source env'}</Badge>
            <span className='text-muted-foreground'>/</span>
            <Badge variant='outline'>
              {sourceTenantName ?? 'source tenant'}
            </Badge>
            <ArrowRight className='h-4 w-4 text-muted-foreground' />
            <Badge variant='secondary'>{destEnvName ?? 'dest env'}</Badge>
            <span className='text-muted-foreground'>/</span>
            <Badge variant='outline'>{destTenantName ?? 'dest tenant'}</Badge>
          </div>

          {/* Tables picker */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label className='text-sm leading-none font-medium'>
                Tables to migrate
              </label>
              {sourceTables.data && sourceTables.data.length > 0 && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={toggleAllTables}
                >
                  {sourceTables.data.every((t) => selectedTables.has(t.name))
                    ? 'Clear selection'
                    : 'Select all'}
                </Button>
              )}
            </div>
            {sourceTables.isLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-9 w-full' />
                ))}
              </div>
            ) : sourceTables.data && sourceTables.data.length > 0 ? (
              <div className='grid max-h-72 grid-cols-1 gap-2 overflow-auto rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-3'>
                {sourceTables.data.map((t) => {
                  const checked = selectedTables.has(t.name)
                  return (
                    <label
                      key={t.qualified}
                      className='flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50'
                    >
                      <input
                        type='checkbox'
                        className='h-4 w-4 accent-primary'
                        checked={checked}
                        onChange={() => toggleTable(t.name)}
                      />
                      <span className='font-medium'>{t.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        ~{Number(t.estimatedRows).toLocaleString()} rows
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : sourceTenant ? (
              <div className='rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                No tables found in source tenant.
              </div>
            ) : (
              <div className='rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                Select a source tenant to list its tables.
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              Leave selection empty to migrate every user table on the source.
            </p>
          </div>

          {/* Behaviour toggles */}
          <div className='flex flex-wrap items-center gap-6 rounded-md border bg-muted/20 px-3 py-2'>
            <label className='flex cursor-pointer items-center gap-2 text-sm'>
              <input
                type='checkbox'
                className='h-4 w-4 accent-primary'
                checked={truncateFirst}
                onChange={(e) => setTruncateFirst(e.target.checked)}
              />
              TRUNCATE destination first
            </label>
            <label className='flex cursor-pointer items-center gap-2 text-sm'>
              <input
                type='checkbox'
                className='h-4 w-4 accent-primary'
                checked={onConflictSkip}
                onChange={(e) => setOnConflictSkip(e.target.checked)}
              />
              ON CONFLICT DO NOTHING
            </label>
          </div>

          {/* Actions */}
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='text-xs text-muted-foreground'>
              Dry-run is safe — only counts rows. Apply will TRUNCATE the
              destination tables and INSERT.
            </p>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                disabled={migration.isPending}
                onClick={() => submit(true)}
              >
                {migration.isPending && result === null ? (
                  <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                ) : (
                  <Eye className='mr-1 h-4 w-4' />
                )}
                Dry run
              </Button>
              <Button
                type='button'
                disabled={migration.isPending}
                onClick={() => submit(false)}
              >
                {migration.isPending && result !== null ? (
                  <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                ) : (
                  <PlayCircle className='mr-1 h-4 w-4' />
                )}
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result panel */}
      {result && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0'>
            <CardTitle className='flex items-center gap-2'>
              {result.dryRun ? (
                <>
                  <Eye className='h-4 w-4' />
                  Dry-run result
                </>
              ) : (
                <>
                  <CircleCheck className='h-4 w-4 text-emerald-500' />
                  Migration result
                </>
              )}
            </CardTitle>
            <div className='flex items-center gap-2'>
              {result.dryRun && (
                <Badge variant='secondary'>
                  <ShieldAlert className='h-3 w-3' /> No writes
                </Badge>
              )}
              {!result.dryRun && (
                <Badge variant='default'>
                  <CircleCheck className='h-3 w-3' /> Applied
                </Badge>
              )}
              <Badge variant='outline'>
                {result.totalRows.toLocaleString()} total rows
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {result.tables.length > 0 ? (
              <div className='overflow-x-auto rounded-md border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 text-left'>
                    {resultTable.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className='px-4 py-3 font-medium text-muted-foreground'
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {resultTable.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className='border-t transition-colors hover:bg-muted/30'
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className='px-4 py-3'>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='flex items-center gap-2 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                <CircleX className='mx-auto h-4 w-4' />
                No tables returned.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Truncate section */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Trash2 className='h-4 w-4 text-red-500' />
            Truncate tenant data
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Removes all rows from selected tables. This operation is permanent
            and cannot be undone.
          </p>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Environment picker */}
          <div className='space-y-2'>
            <label className='text-sm leading-none font-medium'>
              Environment
            </label>
            <Select
              value={truncateEnvId ?? ''}
              onValueChange={handleTruncateEnvChange}
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

          {/* Tenant picker */}
          <div className='space-y-2'>
            <label className='text-sm leading-none font-medium'>Tenant</label>
            <Select
              value={truncateTenant ?? ''}
              onValueChange={handleTruncateTenantChange}
              disabled={!truncateEnvId}
            >
              <SelectTrigger className='w-full'>
                <SelectValue
                  placeholder={
                    truncateEnvId ? 'Select tenant' : 'Pick env first'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {truncateTenants.data?.map((t) => (
                  <SelectItem key={t.tenant_code} value={t.tenant_code}>
                    {t.tenant_code} · {t.tenant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tables to truncate */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label className='text-sm leading-none font-medium'>
                Tables to truncate
              </label>
              {truncateTables.data && truncateTables.data.length > 0 && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    if (!truncateTables.data) return
                    const allNames = truncateTables.data.map((t) => t.name)
                    const allSelected = allNames.every((n) =>
                      truncateSelectedTables.has(n)
                    )
                    if (allSelected) {
                      setTruncateSelectedTables(new Set())
                    } else {
                      setTruncateSelectedTables(new Set(allNames))
                    }
                  }}
                >
                  {truncateTables.data.every((t) =>
                    truncateSelectedTables.has(t.name)
                  )
                    ? 'Clear selection'
                    : 'Select all'}
                </Button>
              )}
            </div>
            {truncateTables.isLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-9 w-full' />
                ))}
              </div>
            ) : truncateTables.data && truncateTables.data.length > 0 ? (
              <div className='grid max-h-72 grid-cols-1 gap-2 overflow-auto rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-3'>
                {truncateTables.data.map((t) => {
                  const checked = truncateSelectedTables.has(t.name)
                  return (
                    <label
                      key={t.qualified}
                      className='flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50'
                    >
                      <input
                        type='checkbox'
                        className='h-4 w-4 accent-primary'
                        checked={checked}
                        onChange={() => {
                          setTruncateSelectedTables((prev) => {
                            const next = new Set(prev)
                            if (next.has(t.name)) next.delete(t.name)
                            else next.add(t.name)
                            return next
                          })
                        }}
                      />
                      <span className='font-medium'>{t.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        ~{Number(t.estimatedRows).toLocaleString()} rows
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : truncateTenant ? (
              <div className='rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                No tables found in tenant.
              </div>
            ) : (
              <div className='rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                Select a tenant to list its tables.
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              Leave selection empty to truncate every user table in the tenant.
            </p>
          </div>

          {/* Execute truncate */}
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='destructive'
              disabled={
                truncateMutation.isPending || !truncateEnvId || !truncateTenant
              }
              onClick={async () => {
                if (!truncateEnvId || !truncateTenant) {
                  toast.error('Pick environment and tenant first.')
                  return
                }
                try {
                  const tablesFilter =
                    truncateSelectedTables.size > 0
                      ? Array.from(truncateSelectedTables)
                      : undefined
                  const outcome = await truncateMutation.mutateAsync({
                    tenantCode: truncateTenant,
                    tables: tablesFilter,
                  })
                  setTruncateResult(outcome)
                  toast.success(`Truncated ${outcome.truncatedCount} tables`)
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'Truncate failed'
                  )
                }
              }}
            >
              {truncateMutation.isPending ? (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              ) : (
                <Trash2 className='mr-1 h-4 w-4' />
              )}
              Truncate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Truncate result panel */}
      {truncateResult && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0'>
            <CardTitle className='flex items-center gap-2'>
              <Database className='h-4 w-4' />
              Truncate result
            </CardTitle>
            <div className='flex items-center gap-2'>
              <Badge variant='destructive'>
                <Trash2 className='h-3 w-3' /> Destructive
              </Badge>
              <Badge variant='outline'>
                {truncateResult.truncatedCount} tables affected
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {truncateResult.tables.length > 0 ? (
              <div className='overflow-x-auto rounded-md border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 text-left'>
                    <tr>
                      <th className='px-4 py-3 font-medium text-muted-foreground'>
                        Table
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {truncateResult.tables.map((t) => (
                      <tr
                        key={t.table}
                        className='border-t transition-colors hover:bg-muted/30'
                      >
                        <td className='px-4 py-3'>
                          <code className='text-xs'>{t.table}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='flex items-center gap-2 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground'>
                <CircleX className='mx-auto h-4 w-4' />
                No tables affected.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
