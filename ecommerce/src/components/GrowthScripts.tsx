import Script from "next/script";
import type { StorefrontConfig } from "@/types/storefront";

type Props = {
  config: StorefrontConfig;
};

export default function GrowthScripts({ config }: Props) {
  const analytics = config.integrations?.google?.analytics;
  const tagManager = config.integrations?.google?.tagManager;
  const ads = config.integrations?.google?.ads;
  const metaPixel = config.integrations?.meta?.pixel;

  const gtagIds = [analytics?.measurementId, ads?.conversionId].filter(
    (value): value is string => Boolean(value && value.trim())
  );

  return (
    <>
      {tagManager?.enabled && tagManager.containerId ? (
        <>
          <Script
            id="growth-gtm-loader"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${tagManager.containerId}');
              `,
            }}
          />
        </>
      ) : null}

      {gtagIds.length ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
              gtagIds[0]
            )}`}
            strategy="afterInteractive"
          />
          <Script
            id="growth-gtag-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${gtagIds
                  .map((id) => `gtag('config', '${id}', { send_page_view: true });`)
                  .join("\n")}
              `,
            }}
          />
        </>
      ) : null}

      {metaPixel?.enabled && metaPixel.pixelId ? (
        <Script
          id="growth-meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixel.pixelId}');
              fbq('track', 'PageView');
            `,
          }}
        />
      ) : null}
    </>
  );
}
