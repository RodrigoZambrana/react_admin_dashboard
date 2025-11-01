export const wrapWithLayout = (content: string) => `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
      <mj-text font-size="14px" color="#111827" line-height="1.5" />
      <mj-button background-color="#111827" color="#ffffff" border-radius="4px" font-size="14px" font-weight="600" padding="16px 24px" />
    </mj-attributes>
    <mj-style>
      .muted { color: #6B7280; font-size: 12px; }
      .pill { border-radius: 9999px; padding: 4px 10px; background-color: #EEF2FF; color: #4338CA; font-weight: 600; font-size: 12px; text-transform: uppercase;}
      .table-header { text-transform: uppercase; color: #6B7280; font-size: 12px; letter-spacing: 0.1em; }
      .table-row { border-bottom: 1px solid #E5E7EB; padding: 8px 0; }
      .item-note { margin-top: 4px; font-size: 12px; color: #6B7280; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#F3F4F6">
    <mj-section background-color="#111827" padding="16px 0">
      <mj-column>
        <mj-text color="#ffffff" font-size="20px" font-weight="600" align="center">{{companyName}}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        ${content}
      </mj-column>
    </mj-section>
    <mj-section background-color="#F9FAFB" padding="16px">
      <mj-column>
        <mj-text css-class="muted" align="center">{{companyFooter}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`
