import { useState } from 'react'
import { Eye, EyeOff, Loader2, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTestConnectionCredentials, type EnvironmentInput } from './api'

export interface EnvironmentFormValues {
  name: string
  host: string
  port: number
  db: string
  user: string
  password: string
  ssl_mode: string
  is_active: boolean
  ismultitenant: boolean
}

const SSL_MODES = [
  { value: 'require', label: 'require' },
  { value: 'disable', label: 'disable' },
] as const

const toFormValues = (
  env?: Partial<EnvironmentInput>
): EnvironmentFormValues => ({
  name: env?.name ?? '',
  host: env?.host ?? '',
  port: env?.port ?? 5432,
  db: env?.db ?? '',
  user: env?.user ?? '',
  password: '',
  ssl_mode: env?.ssl_mode ?? 'require',
  is_active: env?.is_active ?? true,
  ismultitenant: env?.ismultitenant ?? false,
})

const toPayload = (
  values: EnvironmentFormValues,
  includePassword: boolean
): EnvironmentInput => {
  const payload: EnvironmentInput = {
    name: values.name.trim(),
    host: values.host.trim(),
    port: values.port,
    db: values.db.trim(),
    user: values.user.trim(),
    ssl_mode: values.ssl_mode,
    is_active: values.is_active,
    ismultitenant: values.ismultitenant,
  }
  if (includePassword) {
    payload.password = values.password.length > 0 ? values.password : null
  } else if (values.password.length > 0) {
    payload.password = values.password
  }
  return payload
}

export function EnvironmentForm({
  initial,
  submitLabel,
  onSubmit,
  isSubmitting,
}: {
  initial?: Partial<EnvironmentInput>
  submitLabel: string
  onSubmit: (payload: EnvironmentInput) => Promise<void> | void
  isSubmitting?: boolean
}) {
  const [values, setValues] = useState<EnvironmentFormValues>(
    toFormValues(initial)
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof EnvironmentFormValues, string>>
  >({})
  const [showPassword, setShowPassword] = useState(false)
  const testConnection = useTestConnectionCredentials()
  const isEdit = Boolean(initial)

  const set = <K extends keyof EnvironmentFormValues>(
    key: K,
    value: EnvironmentFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof EnvironmentFormValues, string>> = {}
    if (!values.name.trim()) next.name = 'Name is required'
    if (!values.host.trim()) next.host = 'Host is required'
    if (!values.db.trim()) next.db = 'Database is required'
    if (!values.user.trim()) next.user = 'User is required'
    if (
      !Number.isInteger(values.port) ||
      values.port < 1 ||
      values.port > 65535
    ) {
      next.port = 'Port must be between 1 and 65535'
    }
    if (!isEdit && !values.password) {
      next.password = 'Password is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return
    await onSubmit(toPayload(values, !isEdit))
  }

  const handleTestConnection = async () => {
    if (!validate()) return
    try {
      const result = await testConnection.mutateAsync({
        host: values.host.trim(),
        port: values.port,
        db: values.db.trim(),
        user: values.user.trim(),
        password: values.password.length > 0 ? values.password : undefined,
        ssl_mode: values.ssl_mode,
      })
      if (result.connected) {
        toast.success(`Connection successful · ${result.latencyMs}ms`)
      } else {
        toast.error(`Connection failed: ${result.error ?? 'unknown error'}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to test connection'
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Name' error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder='production'
            aria-invalid={Boolean(errors.name)}
          />
        </Field>
        <Field label='Host' error={errors.host}>
          <Input
            value={values.host}
            onChange={(e) => set('host', e.target.value)}
            placeholder='db.example.com'
            aria-invalid={Boolean(errors.host)}
          />
        </Field>
        <Field label='Port' error={errors.port}>
          <Input
            type='number'
            min={1}
            max={65535}
            value={values.port}
            onChange={(e) => set('port', Number(e.target.value) || 0)}
            aria-invalid={Boolean(errors.port)}
          />
        </Field>
        <Field label='Database' error={errors.db}>
          <Input
            value={values.db}
            onChange={(e) => set('db', e.target.value)}
            placeholder='database'
            aria-invalid={Boolean(errors.db)}
          />
        </Field>
        <Field label='User' error={errors.user}>
          <Input
            value={values.user}
            onChange={(e) => set('user', e.target.value)}
            placeholder='user'
            aria-invalid={Boolean(errors.user)}
          />
        </Field>
        <Field
          label={isEdit ? 'New password (optional)' : 'Password'}
          error={errors.password}
        >
          <div className='relative'>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete='off'
              placeholder='password'
              aria-invalid={Boolean(errors.password)}
              className='pr-10'
            />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2'
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className='h-4 w-4' />
              ) : (
                <Eye className='h-4 w-4' />
              )}
            </Button>
          </div>
        </Field>
        <Field label='SSL mode'>
          <Select
            value={values.ssl_mode}
            onValueChange={(v) => set('ssl_mode', v)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select SSL mode' />
            </SelectTrigger>
            <SelectContent>
              {SSL_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className='flex flex-col gap-3 sm:flex-row sm:gap-6'>
        <CheckboxField
          label='Active'
          checked={values.is_active}
          onCheckedChange={(c) => set('is_active', c)}
        />
        <CheckboxField
          label='Multi-tenant'
          checked={values.ismultitenant}
          onCheckedChange={(c) => set('ismultitenant', c)}
        />
      </div>
      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={testConnection.isPending}
          onClick={handleTestConnection}
        >
          {testConnection.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <PlugZap className='mr-2 h-4 w-4' />
          )}
          Test connection
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-2'>
      <label className='text-sm leading-none font-medium'>{label}</label>
      {children}
      {error && <p className='text-xs text-destructive'>{error}</p>}
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className='flex cursor-pointer items-center gap-2 text-sm font-medium'>
      <input
        type='checkbox'
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className={cn(
          'h-4 w-4 rounded border border-input bg-transparent accent-primary'
        )}
      />
      {label}
    </label>
  )
}
