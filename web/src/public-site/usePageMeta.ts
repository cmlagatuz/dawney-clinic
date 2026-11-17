import { useEffect } from 'react'

/** Client-side title + description per public route (static tags live in index.html for crawlers that do not run scripts). */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag) }
    tag.content = description
  }, [title, description])
}
