export async function fetchWpPageBySlug(slug: string) {
  const res = await fetch(`https://www.xplus.com.sg/wp-json/wp/v2/pages?slug=${slug}`)
  const arr = await res.json()
  if (Array.isArray(arr) && arr.length > 0) return arr[0]
  return null
}
