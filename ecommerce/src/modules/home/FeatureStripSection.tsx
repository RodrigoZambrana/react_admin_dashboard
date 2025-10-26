import type { FeatureListModuleConfig } from "@/types/storefront"
import { ShieldCheck, Truck, Headset, CreditCard, Repeat, Activity, Zap, Leaf, Heart, RefreshCcw, MessageCircle, FileCheck, Droplet, Recycle } from "lucide-react"

const iconMap: Record<string, React.ReactNode> = {
  ShieldCheck: <ShieldCheck className="h-6 w-6" />,
  Truck: <Truck className="h-6 w-6" />,
  Headset: <Headset className="h-6 w-6" />,
  CreditCard: <CreditCard className="h-6 w-6" />,
  Repeat: <Repeat className="h-6 w-6" />,
  Activity: <Activity className="h-6 w-6" />,
  Zap: <Zap className="h-6 w-6" />,
  Leaf: <Leaf className="h-6 w-6" />,
  Heart: <Heart className="h-6 w-6" />,
  RefreshCcw: <RefreshCcw className="h-6 w-6" />,
  MessageCircle: <MessageCircle className="h-6 w-6" />,
  FileCheck: <FileCheck className="h-6 w-6" />,
  Droplet: <Droplet className="h-6 w-6" />,
  Recycle: <Recycle className="h-6 w-6" />,
}

interface FeatureStripSectionProps {
  config: FeatureListModuleConfig
}

export const FeatureStripSection: React.FC<FeatureStripSectionProps> = ({ config }) => {
  if (!config.items?.length) {
    return null
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      {config.title ? <h2 className="text-lg font-semibold text-slate-900">{config.title}</h2> : null}
      {config.subtitle ? <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p> : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {config.items.map((item) => (
          <div key={item.id} className="flex items-start gap-4 rounded-xl border border-transparent px-3 py-2 transition hover:border-slate-200">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-900/5 text-slate-900">
              {iconMap[item.icon] ?? iconMap.ShieldCheck}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-900">{item.title}</span>
              <p className="text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
