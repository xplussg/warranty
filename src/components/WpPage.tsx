import { useEffect, useState } from 'react'
import { fetchWpPageBySlug } from '../lib/wp'

export default function WpPage({ slug, title }: { slug: string; title: string }) {
  const [html, setHtml] = useState<string>('')
  useEffect(() => {
    let alive = true
    fetchWpPageBySlug(slug).then(p => {
      if (!alive) return
      setHtml(p?.content?.rendered ?? '')
    })
    return () => { alive = false }
  }, [slug])
  return (
    <section className="container py-12">
      <h2 className="text-2xl font-semibold mb-6">{title}</h2>
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
