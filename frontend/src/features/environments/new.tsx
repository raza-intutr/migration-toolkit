import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateEnvironment } from './api'
import { EnvironmentForm } from './environment-form'

export function NewEnvironmentPage() {
  const navigate = useNavigate()
  const createEnvironment = useCreateEnvironment()

  const handleSubmit = async (payload: Parameters<typeof createEnvironment.mutateAsync>[0]) => {
    try {
      await createEnvironment.mutateAsync(payload)
      toast.success(`Environment "${payload.name}" created`)
      navigate({ to: '/environments' })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create environment',
      )
    }
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>New environment</CardTitle>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/environments'>Cancel</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <EnvironmentForm
          submitLabel='Create environment'
          onSubmit={handleSubmit}
          isSubmitting={createEnvironment.isPending}
        />
      </CardContent>
    </Card>
  )
}
