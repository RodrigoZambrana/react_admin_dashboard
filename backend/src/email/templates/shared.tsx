import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Body, Container, Head, Html, Section, Text } from '@react-email/components'

type EmailShellProps = {
  companyName: string
  companyFooter: string
  contentHtml: string
}

const EmailShell = ({ companyName, companyFooter, contentHtml }: EmailShellProps) => (
  <Html lang="en">
    <Head />
    <Body style={{ backgroundColor: '#F3F4F6', margin: '0', padding: '24px 0' }}>
      <Container style={{ maxWidth: '640px', margin: '0 auto' }}>
        <Section style={{ backgroundColor: '#111827', padding: '16px 0' }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: '600',
              textAlign: 'center',
              margin: '0',
            }}
          >
            {companyName}
          </Text>
        </Section>
        <Section style={{ backgroundColor: '#ffffff', padding: '24px' }}>
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </Section>
        <Section style={{ backgroundColor: '#F9FAFB', padding: '16px' }}>
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
      contentHtml={content}
    />,
  )

  return wrapAsHtmlDocument(markup)
}
