import { createFileRoute } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { MigrationRunsPage } from '@/features/migration-runs'

export const Route = createFileRoute('/_authenticated/migration-runs/')({
  component: MigrationRunsRoute,
})

function MigrationRunsRoute() {
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
          <h1 className='text-2xl font-bold tracking-tight'>
            Migration runs
          </h1>
        </div>
        <MigrationRunsPage />
      </Main>
    </>
  )
}