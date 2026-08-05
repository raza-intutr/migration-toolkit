import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useEnvironments } from '@/features/environments/api'
import { useEnvironmentTenants, useTenantTables, type TableInfo } from './api'

export function TenantTablesPage() {
  const { data: environments, isLoading: environmentsLoading } =
    useEnvironments()
  const [environmentId, setEnvironmentId] = useState<string | undefined>()
  const [tenantCode, setTenantCode] = useState<string | undefined>()

  const { data: tenants, isLoading: tenantsLoading } =
    useEnvironmentTenants(environmentId)
  const { data: tables, isLoading: tablesLoading } = useTenantTables(
    environmentId,
    tenantCode
  )

  const columns = useMemo<ColumnDef<TableInfo>[]>(
    () => [
      { header: 'Schema', accessorKey: 'schema' },
      {
        header: 'Table',
        accessorKey: 'name',
        cell: ({ row }) => (
          <span className='font-medium'>{row.original.name}</span>
        ),
      },
      {
        header: 'Qualified',
        accessorKey: 'qualified',
        cell: ({ row }) => (
          <code className='text-xs text-muted-foreground'>
            {row.original.qualified}
          </code>
        ),
      },
      {
        header: 'Est. rows',
        accessorKey: 'estimatedRows',
        cell: ({ row }) => {
          const rows = Number(row.original.estimatedRows)
          return rows >= 0 ? (
            <span className='tabular-nums'>{rows.toLocaleString()}</span>
          ) : (
            <span className='text-muted-foreground'>—</span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: tables ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Tenant tables</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <label className='text-sm leading-none font-medium'>
              Environment
            </label>
            <Select
              value={environmentId}
              onValueChange={(value) => {
                setEnvironmentId(value)
                setTenantCode(undefined)
              }}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Select an environment' />
              </SelectTrigger>
              <SelectContent>
                {environmentsLoading ? (
                  <SelectItem value='__loading__' disabled>
                    Loading…
                  </SelectItem>
                ) : (
                  environments?.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <label className='text-sm leading-none font-medium'>Tenant</label>
            <Select
              value={tenantCode}
              onValueChange={setTenantCode}
              disabled={!environmentId}
            >
              <SelectTrigger className='w-full'>
                <SelectValue
                  placeholder={
                    environmentId
                      ? 'Select a tenant'
                      : 'Select an environment first'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {tenantsLoading ? (
                  <SelectItem value='__loading__' disabled>
                    Loading…
                  </SelectItem>
                ) : (
                  tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.tenant_code}>
                      {tenant.tenant_code} · {tenant.tenant_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tablesLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : tenantCode ? (
          tables && tables.length > 0 ? (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-left'>
                  {table.getHeaderGroups().map((headerGroup) => (
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
                  {table.getRowModel().rows.map((row) => (
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
            <div className='rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground'>
              No tables found for tenant.
            </div>
          )
        ) : (
          <div className='rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground'>
            Select an environment and a tenant to view its tables.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
