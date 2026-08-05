import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  PlugZap,
  Plus,
  Trash2,
  CircleCheck,
  CircleX,
} from 'lucide-react'
import { toast } from 'sonner'
import useDialogState from '@/hooks/use-dialog-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  useDeleteEnvironment,
  useEnvironmentHealth,
  useEnvironments,
  useTestConnection,
  type Environment,
} from './api'

export function EnvironmentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading } = useEnvironments()
  const { data: healthData } = useEnvironmentHealth()
  const deleteEnvironment = useDeleteEnvironment()
  const testConnection = useTestConnection()
  const [confirmDelete, setConfirmDelete] = useDialogState<boolean>(false)
  const [target, setTarget] = useState<Environment | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const healthByEnvironment = useMemo(() => {
    const map = new Map<
      string,
      { connected: boolean; latencyMs: number | null }
    >()
    for (const env of healthData ?? []) {
      map.set(env.environmentId, {
        connected: env.connected,
        latencyMs: env.latencyMs,
      })
    }
    return map
  }, [healthData])

  const openDelete = (environment: Environment) => {
    setTarget(environment)
    setConfirmDelete(true)
  }
  const closeDelete = () => {
    setConfirmDelete(null)
    setTarget(null)
  }

  const handleTestConnection = async (environment: Environment) => {
    setTestingId(environment.id)
    try {
      const result = await testConnection.mutateAsync(environment.id)
      if (result.connected) {
        toast.success(
          `Connected to "${environment.name}" · ${result.latencyMs}ms`
        )
      } else {
        toast.error(`Connection failed: ${result.error ?? 'unknown error'}`)
      }
      queryClient.invalidateQueries({ queryKey: ['environments', 'health'] })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to test connection'
      )
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!target) return
    try {
      await deleteEnvironment.mutateAsync(target.id)
      toast.success(`Environment "${target.name}" deleted`)
      closeDelete()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete environment'
      )
    }
  }

  const columns = useMemo<ColumnDef<Environment>[]>(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <span className='font-medium'>{row.original.name}</span>
        ),
      },
      { header: 'Host', accessorKey: 'host' },
      {
        header: 'Port',
        accessorKey: 'port',
        cell: ({ row }) => (
          <span className='tabular-nums'>{row.original.port}</span>
        ),
      },
      { header: 'Database', accessorKey: 'db' },
      { header: 'User', accessorKey: 'user' },
      { header: 'SSL', accessorKey: 'ssl_mode' },
      {
        header: 'Status',
        accessorKey: 'is_active',
        cell: ({ row }) => {
          const health = healthByEnvironment.get(row.original.id)
          const connected = health?.connected
          if (connected === undefined) {
            return <span className='text-muted-foreground'>—</span>
          }
          return connected ? (
            <Badge variant='default'>
              <CircleCheck className='h-3 w-3' />
              {health?.latencyMs != null
                ? `${health.latencyMs}ms`
                : 'connected'}
            </Badge>
          ) : (
            <Badge variant='destructive'>
              <CircleX className='h-3 w-3' />
              unreachable
            </Badge>
          )
        },
      },
      {
        header: 'Multi-tenant',
        accessorKey: 'ismultitenant',
        cell: ({ row }) =>
          row.original.ismultitenant ? (
            <Badge variant='secondary'>yes</Badge>
          ) : (
            <span className='text-muted-foreground'>no</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className='flex justify-end'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' aria-label='Row actions'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={() =>
                    navigate({
                      to: '/environments/$id/edit',
                      params: { id: row.original.id },
                    })
                  }
                >
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={testingId === row.original.id}
                  onClick={() => handleTestConnection(row.original)}
                >
                  {testingId === row.original.id ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <PlugZap className='mr-2 h-4 w-4' />
                  )}
                  Test connection
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant='destructive'
                  onClick={() => openDelete(row.original)}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [navigate, openDelete, handleTestConnection, testingId, healthByEnvironment]
  )

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0'>
          <CardTitle>Environments</CardTitle>
          <Button asChild size='sm'>
            <Link to='/environments/new'>
              <Plus className='mr-1 h-4 w-4' />
              New environment
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-3'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : data && data.length > 0 ? (
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
            <div className='flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-12 text-center text-muted-foreground'>
              <p className='text-sm'>No environments yet.</p>
              <Button asChild variant='outline' size='sm'>
                <Link to='/environments/new'>
                  <Plus className='mr-1 h-4 w-4' />
                  Create your first environment
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete "${target?.name ?? ''}"?`}
        desc={
          <p>
            This permanently removes the environment record. Existing pooled
            connections to it will be closed.
          </p>
        }
        destructive
        isLoading={deleteEnvironment.isPending}
        handleConfirm={handleDelete}
        confirmText='Delete'
      />
    </>
  )
}
