import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { toast } from 'sonner'
import useDialogState from '@/hooks/use-dialog-state'
import {
  useDeleteEnvironment,
  useEnvironments,
  type Environment,
} from './api'

export function EnvironmentsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useEnvironments()
  const deleteEnvironment = useDeleteEnvironment()
  const [confirmDelete, setConfirmDelete] = useDialogState<boolean>(false)
  const [target, setTarget] = useState<Environment | null>(null)

  const openDelete = (environment: Environment) => {
    setTarget(environment)
    setConfirmDelete(true)
  }
  const closeDelete = () => {
    setConfirmDelete(null)
    setTarget(null)
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
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge variant='default'>active</Badge>
          ) : (
            <Badge variant='secondary'>inactive</Badge>
          ),
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
    [navigate, openDelete],
  )

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleDelete = async () => {
    if (!target) return
    try {
      await deleteEnvironment.mutateAsync(target.id)
      toast.success(`Environment "${target.name}" deleted`)
      closeDelete()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete environment',
      )
    }
  }

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
                                header.getContext(),
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
                            cell.getContext(),
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
