import type { TestimonialModuleConfig } from "@/types/storefront"

interface TestimonialsSectionProps {
  config: TestimonialModuleConfig
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ config }) => {
  if (!config.testimonials?.length) {
    return null
  }

  const layout = config.layout ?? "carousel"

  return (
    <section className="space-y-6">
      {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
      {config.subtitle ? <p className="text-sm text-slate-500">{config.subtitle}</p> : null}
      <div
        className={
          layout === "grid"
            ? "grid gap-4 sm:grid-cols-2"
            : "flex gap-4 overflow-x-auto pb-4"
        }
      >
        {config.testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="min-w-[18rem] max-w-[26rem] rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-sm text-slate-600">&ldquo;{testimonial.quote}&rdquo;</p>
            <div className="mt-4 flex flex-col gap-1 text-sm font-semibold text-slate-900">
              <span>{testimonial.author}</span>
              {testimonial.role ? <span className="text-xs font-normal text-slate-500">{testimonial.role}</span> : null}
              {testimonial.rating ? (
                <span className="text-xs font-semibold text-amber-500">{testimonial.rating.toFixed(1)} ★</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
