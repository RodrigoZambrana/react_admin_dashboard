import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Body, Container, Head, Html, Img, Section, Text } from '@react-email/components'

type EmailShellProps = {
  companyName: string
  companyFooter: string
  companyLogo?: string | null
  contentHtml: string
}

const EmailShell = ({ companyName, companyFooter, companyLogo, contentHtml }: EmailShellProps) => (
  <Html lang="en">
    <Head />
    <Body style={{ backgroundColor: '#F3F4F6', margin: '0', padding: '24px 0' }}>
      <Container style={{ maxWidth: '640px', margin: '0 auto' }}>
        <Section
          style={{
            background:
              'linear-gradient(135deg, #103B34 0%, #1F6F5F 58%, #D9A441 100%)',
            padding: '24px 28px',
            borderRadius: '24px 24px 0 0',
          }}
        >
          {companyLogo ? (
            <Img
              src={companyLogo}
              alt={companyName}
              width="144"
              style={{ display: 'block', margin: '0 auto 14px', maxWidth: '144px', height: 'auto' }}
            />
          ) : null}
          <Text
            style={{
              color: '#ffffff',
              fontSize: '22px',
              fontWeight: '700',
              textAlign: 'center',
              margin: '0',
              letterSpacing: '0.02em',
            }}
          >
            {companyName}
          </Text>
        </Section>
        <Section
          style={{
            backgroundColor: '#ffffff',
            padding: '28px',
            borderLeft: '1px solid #E5E7EB',
            borderRight: '1px solid #E5E7EB',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </Section>
        <Section
          style={{
            backgroundColor: '#F9FAFB',
            padding: '18px 22px',
            borderRadius: '0 0 24px 24px',
            border: '1px solid #E5E7EB',
            borderTop: '0',
          }}
        >
          <Text
            style={{
              color: '#6B7280',
              fontSize: '12px',
              lineHeight: '1.5',
              margin: '0',
              textAlign: 'center',
            }}
          >
            {companyFooter}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

const wrapAsHtmlDocument = (markup: string) =>
  `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${markup}`

export const wrapWithLayout = (content: string) => {
  const markup = renderToStaticMarkup(
    <EmailShell
      companyName="{{companyName}}"
      companyFooter="{{companyFooter}}"
      companyLogo="{{companyLogo}}"
      contentHtml={content}
    />,
  )

  return wrapAsHtmlDocument(markup)
}
