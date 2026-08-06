import {
  ArrowRightLeft,
  Command,
  Globe,
  LayoutDashboard,
  Table
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Offline Tool',
    email: 'admin@offline.local',
    avatar: '',
  },
  teams: [
    {
      name: 'Offline Tool',
      logo: Command,
      plan: 'Offline Tool',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Environments',
          url: '/environments',
          icon: Globe,
        },
        {
          title: 'Tenant tables',
          url: '/tenant-tables',
          icon: Table,
        },
        // {
        //   title: 'Migrations',
        //   url: '/migrations',
        //   icon: ArrowRightLeft,
        // },
        {
          title: 'Migration runs',
          url: '/migration-runs',
          icon: ArrowRightLeft,
        },
      ],
    },
  ],
}
