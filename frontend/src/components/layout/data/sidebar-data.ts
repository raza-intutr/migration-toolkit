import { Command, LayoutDashboard } from 'lucide-react'
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
      ],
    },
  ],
}
