import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, Building2, Layers, Users, type LucideIcon } from 'lucide-react'
import { useDashboard } from './api'
import { EnvironmentHealth } from './components/environment-health'
import { Overview } from './components/overview'
import { RecentTenants } from './components/recent-tenants'

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className='h-8 w-20' />
        ) : (
          <div className='text-2xl font-bold'>{value}</div>
        )}
        <p className='text-xs text-muted-foreground'>{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const { data, isLoading } = useDashboard()

  const environments = data?.environments
  const tenants = data?.tenants
  const health = data?.health

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
        </div>
        <Tabs orientation='vertical' defaultValue='overview' className='space-y-4'>
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              <StatCard
                title='Environments'
                value={String(environments?.total ?? 0)}
                subtitle={`${environments?.active ?? 0} active`}
                icon={Building2}
                loading={isLoading}
              />
              <StatCard
                title='Tenants'
                value={String(tenants?.total ?? 0)}
                subtitle={`${tenants?.b2b ?? 0} B2B · ${tenants?.b2c ?? 0} B2C`}
                icon={Users}
                loading={isLoading}
              />
              <StatCard
                title='Reachable'
                value={String(health?.connected ?? 0)}
                subtitle={`${health?.unreachable ?? 0} offline`}
                icon={Activity}
                loading={isLoading}
              />
              <StatCard
                title='Active Environments'
                value={String(environments?.active ?? 0)}
                subtitle={`of ${environments?.total ?? 0} total`}
                icon={Layers}
                loading={isLoading}
              />
            </div>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='col-span-1 lg:col-span-4'>
                <CardHeader>
                  <CardTitle>Tenants per Environment</CardTitle>
                </CardHeader>
                <CardContent className='ps-2'>
                  {isLoading ? (
                    <Skeleton className='h-[350px] w-full' />
                  ) : (
                    <Overview data={data?.tenantsByEnvironment ?? []} />
                  )}
                </CardContent>
              </Card>
              <Card className='col-span-1 lg:col-span-3'>
                <CardHeader>
                  <CardTitle>Environment Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <EnvironmentHealth
                    environments={data?.environmentHealth ?? []}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </div>
            <Card className='col-span-1'>
              <CardHeader>
                <CardTitle>Recent Tenants</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentTenants
                  tenants={data?.recentTenants ?? []}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
]
