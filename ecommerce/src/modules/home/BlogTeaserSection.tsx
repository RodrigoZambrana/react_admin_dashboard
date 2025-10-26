// @ts-nocheck

import Link from "next/link"
import Image from "next/image"
import type { BlogSummary, BlogTeaserModuleConfig } from "@/types/storefront"

interface BlogTeaserSectionProps {
  config: BlogTeaserModuleConfig
  posts: BlogSummary[]
}

export const BlogTeaserSection: React.FC<BlogTeaserSectionProps> = ({ config, posts }) => {
  if (!posts.length) {
    return null
  }

  const highlightFirst = config.highlightFirst ?? false
  const [first, ...rest] = posts

  return (
    <section className="space-y-6">
      {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
      {config.subtitle ? <p className="text-sm text-slate-500">{config.subtitle}</p> : null}
      <div
        className={
          highlightFirst ? "grid gap-6 sm:grid-cols-[2fr,1fr] sm:items-stretch" : "grid gap-6 sm:grid-cols-3"
        }
      >
        {highlightFirst && first ? (
          <article className="group overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <Link href={`/blog/${first.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
              {first.coverImage?.url ? (
                <Image
                  src={first.coverImage.url}
                  alt={first.coverImage.alt ?? first.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
              ) : null}
            </Link>
            <div className="space-y-3 px-6 pb-6 pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {new Date(first.publishedAt).toLocaleDateString()}
              </p>
              <Link
                href={`/blog/${first.slug}`}
                className="block text-lg font-semibold text-slate-900 transition hover:text-slate-600"
              >
                {first.title}
              </Link>
              <p className="text-sm text-slate-500 line-clamp-3">{first.excerpt}</p>
              {first.author ? <span className="text-xs font-semibold text-slate-600">{first.author.name}</span> : null}
            </div>
          </article>
        ) : null}
        <div className={highlightFirst ? "flex flex-col gap-4" : "contents"}>
          {(highlightFirst ? rest : posts).map((post) => (
            <article
              key={post.id}
              className="group overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
                {post.coverImage?.url ? (
                  <Image
                    src={post.coverImage.url}
                    alt={post.coverImage.alt ?? post.title}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : null}
              </Link>
              <div className="space-y-3 px-5 pb-5 pt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="block text-base font-semibold text-slate-900 transition hover:text-slate-600"
                >
                  {post.title}
                </Link>
                <p className="text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
