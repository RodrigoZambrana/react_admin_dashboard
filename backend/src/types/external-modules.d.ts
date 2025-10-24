declare module 'imapflow' {
  export type FetchMessageObject = any;
  export type MailboxObject = any;
  export type ListResponse = any;
  export type AppendResponseObject = any;
  export type ImapFlowOptions = any;
  export class ImapFlow {
    constructor(options: ImapFlowOptions);
    [key: string]: any;
  }
}

declare module 'nodemailer' {
  export interface SentMessageInfo {
    [key: string]: any;
  }
  export type Transporter = any;
  const nodemailer: {
    createTransport: (...args: any[]) => Transporter;
    [key: string]: any;
  };
  export = nodemailer;
}

declare module 'nodemailer/lib/mailer' {
  namespace Mail {
    interface Options {
      [key: string]: any;
    }
  }
  const Mail: any;
  export = Mail;
}

declare module 'nodemailer/lib/mail-composer' {
  const MailComposer: any;
  export = MailComposer;
}

declare module 'nodemailer/lib/smtp-transport' {
  namespace SMTPTransport {
    interface Options {
      [key: string]: any;
    }
  }
  const SMTPTransport: any;
  export = SMTPTransport;
}

declare module 'mailparser' {
  export type ParsedMail = any;
  export type AddressObject = any;
  export function simpleParser(...args: any[]): Promise<ParsedMail>;
}

declare module 'pdfkit' {
  import type { Readable } from 'stream';
  interface PDFDocumentOptions {
    [key: string]: any;
  }
  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    [key: string]: any;
  }
  export default PDFDocument;
}
