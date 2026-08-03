import { BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface OverviewDatum {
  name: string
  tenantCount: number
}

export function Overview({ data }: { data: OverviewDatum[] }) {
  if (data.length === 0) {
    return (
      <div className='flex h-[350px] flex-col items-center justify-center gap-2 text-muted-foreground'>
        <BarChart3 className='h-8 w-8' />
        <p className='text-sm'>No tenants across environments yet.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          direction='ltr'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: 'var(--muted)' }} />
        <Bar
          dataKey='tenantCount'
          fill='currentColor'
          radius={[4, 4, 0, 0]}
          className='fill-primary'
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
