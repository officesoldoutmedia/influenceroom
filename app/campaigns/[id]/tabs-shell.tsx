'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/lib/ui'

export function CampaignTabsShell({
  details,
  participants,
  deliverables,
  milestones,
  tasks,
}: {
  details: ReactNode
  participants: ReactNode
  deliverables: ReactNode
  milestones: ReactNode
  tasks: ReactNode
}) {
  return (
    <Tabs defaultValue="details" className="space-y-6">
      <div className="sticky top-14 z-10 -mx-4 sm:mx-0 bg-stone-50/85 backdrop-blur-md">
        <TabsList>
          <TabsTrigger value="details">Detalii</TabsTrigger>
          <TabsTrigger value="participants">Participanți</TabsTrigger>
          <TabsTrigger value="deliverables">Livrabile</TabsTrigger>
          <TabsTrigger value="milestones">Etape</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="details">{details}</TabsContent>
      <TabsContent value="participants">{participants}</TabsContent>
      <TabsContent value="deliverables">{deliverables}</TabsContent>
      <TabsContent value="milestones">{milestones}</TabsContent>
      <TabsContent value="tasks">{tasks}</TabsContent>
    </Tabs>
  )
}
