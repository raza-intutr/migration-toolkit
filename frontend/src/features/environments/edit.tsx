import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useEnvironment, useUpdateEnvironment } from './api'
import { EnvironmentForm } from './environment-form'

export function EditEnvironmentPage() {
  const params = useParams({ from: '/_authenticated/environments/$id/edit' })
  const id = params.id
  const navigate = useNavigate()
  const { data, isLoading, isError } = useEnvironment(id)
  const updateEnvironment = useUpdateEnvironment(id)

  const handleSubmit = async (
    payload: Parameters<typeof updateEnvironment.mutateAsync>[0],
  ) => {
    try {
      await updateEnvironment.mutateAsync(payload)
      toast.success(`Environment "${payload.name ?? data?.name}" updated`)
      navigate({ to: '/environments' })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update environment',
      )
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit environment</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
          <Skeleton className='h-9 w-full' />
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment not found</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant='outline'>
            <Link to='/environments'>Back to environments</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Edit {data.name}</CardTitle>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/environments'>Cancel</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <EnvironmentForm
          initial={data}
          submitLabel='Save changes'
          onSubmit={handleSubmit}
          isSubmitting={updateEnvironment.isPending}
        />
      </CardContent>
    </Card>
  )
}
