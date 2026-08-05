import { createFileRoute } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { TenantTablesPage } from '@/features/tenant-tables'

export const Route = createFileRoute('/_authenticated/tenant-tables')({
  component: TenantTablesRoute,
})

function TenantTablesRoute() {
  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-4 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Tenant tables</h1>
        </div>
        <TenantTablesPage />
      </Main>
    </>
  )
}
