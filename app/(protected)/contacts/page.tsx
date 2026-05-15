import { Suspense } from 'react'
import ContactsClient from './contacts-client'

export const metadata = { title: 'Contacts' }

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-secondary-text">Loading contacts…</div>}>
      <ContactsClient />
    </Suspense>
  )
}
