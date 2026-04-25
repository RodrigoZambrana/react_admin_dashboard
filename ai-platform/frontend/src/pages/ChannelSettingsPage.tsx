import { FormEvent, useEffect, useState } from 'react';

import {
  getEmailChannelSettings,
  getMetaChannelSettings,
  getWhatsappQrChannelSettings,
  syncMetaChannelSettings,
  syncWhatsappQrChannelSettings,
  updateEmailChannelSettings,
  updateMetaChannelSettings,
  updateWhatsappQrChannelSettings,
} from '../api';
import { PageHeader } from '../components/shared/PageHeader';
import type {
  EmailChannelSettingsView,
  MetaChannelSettingsView,
  WhatsappQrChannelSettingsView,
} from '../types';

type MetaDraft = Omit<
  MetaChannelSettingsView['config'],
  | 'verifyToken'
  | 'appSecret'
  | 'pageAccessToken'
  | 'messengerPageAccessToken'
  | 'instagramAccessToken'
> & {
  verifyToken?: string;
  appSecret?: string;
  pageAccessToken?: string;
  messengerPageAccessToken?: string;
  instagramAccessToken?: string;
};

type WhatsappDraft = WhatsappQrChannelSettingsView['config'];
type EmailDraft = EmailChannelSettingsView & { password?: string };

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toMetaDraft = (config: MetaChannelSettingsView['config']): MetaDraft => ({
  enabled: config.enabled,
  messengerEnabled: config.messengerEnabled,
  instagramEnabled: config.instagramEnabled,
  publicBaseUrl: config.publicBaseUrl,
  pageId: config.pageId,
  instagramBusinessAccountId: config.instagramBusinessAccountId,
  appId: config.appId,
});

export function ChannelSettingsPage() {
  const [meta, setMeta] = useState<MetaChannelSettingsView | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsappQrChannelSettingsView | null>(null);
  const [email, setEmail] = useState<EmailChannelSettingsView | null>(null);
  const [metaDraft, setMetaDraft] = useState<MetaDraft | null>(null);
  const [whatsappDraft, setWhatsappDraft] = useState<WhatsappDraft | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metaData, whatsappData, emailData] = await Promise.all([
        getMetaChannelSettings(),
        getWhatsappQrChannelSettings(),
        getEmailChannelSettings(),
      ]);
      setMeta(metaData);
      setWhatsapp(whatsappData);
      setEmail(emailData);
      setMetaDraft(toMetaDraft(metaData.config));
      setWhatsappDraft(whatsappData.config);
      setEmailDraft(emailData);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveMeta = async (event: FormEvent) => {
    event.preventDefault();
    if (!metaDraft) {
      return;
    }

    await save('meta', async () => {
      const updated = await updateMetaChannelSettings(metaDraft);
      setMeta(updated);
      setMetaDraft(toMetaDraft(updated.config));
    });
  };

  const saveWhatsapp = async (event: FormEvent) => {
    event.preventDefault();
    if (!whatsappDraft) {
      return;
    }

    await save('whatsapp', async () => {
      const updated = await updateWhatsappQrChannelSettings(whatsappDraft);
      setWhatsapp(updated);
      setWhatsappDraft(updated.config);
    });
  };

  const saveEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailDraft) {
      return;
    }

    await save('email', async () => {
      const updated = await updateEmailChannelSettings({
        imapHost: emailDraft.imapHost,
        imapPort: emailDraft.imapPort,
        imapSecurity: emailDraft.imapSecurity,
        smtpHost: emailDraft.smtpHost,
        smtpPort: emailDraft.smtpPort,
        smtpSecurity: emailDraft.smtpSecurity,
        username: emailDraft.username,
        password: emailDraft.password,
        fromAddress: emailDraft.fromAddress,
        fromName: emailDraft.fromName,
        maxAttachmentSizeMb: emailDraft.maxAttachmentSizeMb,
        ratePerMinute: emailDraft.ratePerMinute,
        pollIntervalMs: emailDraft.pollIntervalMs,
        pollBatchSize: emailDraft.pollBatchSize,
      });
      setEmail(updated);
      setEmailDraft(updated);
    });
  };

  const save = async (key: string, action: () => Promise<void>) => {
    try {
      setSaving(key);
      setNotice(null);
      setError(null);
      await action();
      setNotice('Channel settings saved.');
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const syncChannel = async (key: 'meta' | 'whatsapp') => {
    await save(key, async () => {
      if (key === 'meta') {
        const updated = await syncMetaChannelSettings();
        setMeta(updated);
        setMetaDraft(toMetaDraft(updated.config));
        return;
      }

      const updated = await syncWhatsappQrChannelSettings();
      setWhatsapp(updated);
      setWhatsappDraft(updated.config);
    });
  };

  return (
    <>
      <PageHeader
        title="Channel Settings"
        section="Chat Platform Control"
        description="Manage conversational channel configuration from the chat platform control plane."
      />

      {error ? (
        <div className="alert alert-danger custom-react-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-success custom-react-alert" role="status">
          {notice}
        </div>
      ) : null}

      <div className="row">
        <div className="col-xl-6 d-flex">
          <form className="card flex-fill" onSubmit={saveMeta}>
            <div className="card-header d-flex align-items-center justify-content-between">
              <div>
                <h5 className="mb-1">Meta</h5>
                <p className="mb-0 text-muted">Messenger and Instagram channel control.</p>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => void syncChannel('meta')}
                disabled={loading || saving === 'meta'}
              >
                <i className="ti ti-refresh me-1"></i>Sync
              </button>
            </div>
            <div className="card-body">
              <ChannelStatus
                enabled={meta?.status.enabled ?? false}
                health={meta?.status.webhookInboundReady ? 'ready' : 'needs setup'}
                detail={meta?.status.driver ?? 'not loaded'}
              />
              {metaDraft ? (
                <>
                  <Toggle
                    label="Enabled"
                    checked={metaDraft.enabled}
                    onChange={(checked) => setMetaDraft({ ...metaDraft, enabled: checked })}
                  />
                  <Toggle
                    label="Messenger"
                    checked={metaDraft.messengerEnabled}
                    onChange={(checked) =>
                      setMetaDraft({ ...metaDraft, messengerEnabled: checked })
                    }
                  />
                  <Toggle
                    label="Instagram"
                    checked={metaDraft.instagramEnabled}
                    onChange={(checked) =>
                      setMetaDraft({ ...metaDraft, instagramEnabled: checked })
                    }
                  />
                  <TextInput
                    label="Public base URL"
                    value={metaDraft.publicBaseUrl ?? ''}
                    onChange={(value) => setMetaDraft({ ...metaDraft, publicBaseUrl: value || null })}
                  />
                  <TextInput
                    label="Page ID"
                    value={metaDraft.pageId ?? ''}
                    onChange={(value) => setMetaDraft({ ...metaDraft, pageId: value || null })}
                  />
                  <TextInput
                    label="Instagram business account ID"
                    value={metaDraft.instagramBusinessAccountId ?? ''}
                    onChange={(value) =>
                      setMetaDraft({
                        ...metaDraft,
                        instagramBusinessAccountId: value || null,
                      })
                    }
                  />
                  <TextInput
                    label="App ID"
                    value={metaDraft.appId ?? ''}
                    onChange={(value) => setMetaDraft({ ...metaDraft, appId: value || null })}
                  />
                  <SecretInput
                    label="Verify token"
                    onChange={(value) => setMetaDraft({ ...metaDraft, verifyToken: value })}
                  />
                  <SecretInput
                    label="App secret"
                    onChange={(value) => setMetaDraft({ ...metaDraft, appSecret: value })}
                  />
                  <SecretInput
                    label="Page access token"
                    onChange={(value) => setMetaDraft({ ...metaDraft, pageAccessToken: value })}
                  />
                </>
              ) : null}
            </div>
            <CardFooter busy={saving === 'meta'} />
          </form>
        </div>

        <div className="col-xl-6 d-flex">
          <form className="card flex-fill" onSubmit={saveWhatsapp}>
            <div className="card-header d-flex align-items-center justify-content-between">
              <div>
                <h5 className="mb-1">WhatsApp QR</h5>
                <p className="mb-0 text-muted">Session behavior and outbound limits.</p>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => void syncChannel('whatsapp')}
                disabled={loading || saving === 'whatsapp'}
              >
                <i className="ti ti-refresh me-1"></i>Sync
              </button>
            </div>
            <div className="card-body">
              <ChannelStatus
                enabled={whatsapp?.status.enabled ?? false}
                health={whatsapp?.status.state ?? 'not loaded'}
                detail={whatsapp?.status.connectedPhone ?? whatsapp?.status.driver ?? 'not connected'}
              />
              {whatsappDraft ? (
                <>
                  <Toggle
                    label="Enabled"
                    checked={whatsappDraft.enabled}
                    onChange={(checked) =>
                      setWhatsappDraft({ ...whatsappDraft, enabled: checked })
                    }
                  />
                  <Toggle
                    label="Auto start"
                    checked={whatsappDraft.autoStart}
                    onChange={(checked) =>
                      setWhatsappDraft({ ...whatsappDraft, autoStart: checked })
                    }
                  />
                  <TextInput
                    label="Display name"
                    value={whatsappDraft.displayName}
                    onChange={(value) =>
                      setWhatsappDraft({ ...whatsappDraft, displayName: value })
                    }
                  />
                  <TextInput
                    label="Address"
                    value={whatsappDraft.address ?? ''}
                    onChange={(value) =>
                      setWhatsappDraft({ ...whatsappDraft, address: value || null })
                    }
                  />
                  <NumberInput
                    label="Max outbound per hour"
                    value={whatsappDraft.maxOutboundPerHour}
                    onChange={(value) =>
                      setWhatsappDraft({ ...whatsappDraft, maxOutboundPerHour: value })
                    }
                  />
                  <NumberInput
                    label="Max outbound per day"
                    value={whatsappDraft.maxOutboundPerDay}
                    onChange={(value) =>
                      setWhatsappDraft({ ...whatsappDraft, maxOutboundPerDay: value })
                    }
                  />
                </>
              ) : null}
            </div>
            <CardFooter busy={saving === 'whatsapp'} />
          </form>
        </div>

        <div className="col-12 d-flex">
          <form className="card flex-fill" onSubmit={saveEmail}>
            <div className="card-header">
              <h5 className="mb-1">Email Inbox Channel</h5>
              <p className="mb-0 text-muted">
                IMAP/SMTP transport settings for conversational email. Transactional
                email delivery remains outside channel control.
              </p>
            </div>
            <div className="card-body">
              {emailDraft ? (
                <div className="row">
                  <div className="col-lg-4">
                    <TextInput
                      label="IMAP host"
                      value={emailDraft.imapHost}
                      onChange={(value) => setEmailDraft({ ...emailDraft, imapHost: value })}
                    />
                  </div>
                  <div className="col-lg-2">
                    <NumberInput
                      label="IMAP port"
                      value={emailDraft.imapPort}
                      onChange={(value) => setEmailDraft({ ...emailDraft, imapPort: value })}
                    />
                  </div>
                  <div className="col-lg-3">
                    <SelectInput
                      label="IMAP security"
                      value={emailDraft.imapSecurity}
                      options={['SSL_TLS', 'STARTTLS', 'NONE']}
                      onChange={(value) =>
                        setEmailDraft({
                          ...emailDraft,
                          imapSecurity: value as EmailDraft['imapSecurity'],
                        })
                      }
                    />
                  </div>
                  <div className="col-lg-3">
                    <TextInput
                      label="Username"
                      value={emailDraft.username}
                      onChange={(value) => setEmailDraft({ ...emailDraft, username: value })}
                    />
                  </div>
                  <div className="col-lg-4">
                    <TextInput
                      label="SMTP host"
                      value={emailDraft.smtpHost}
                      onChange={(value) => setEmailDraft({ ...emailDraft, smtpHost: value })}
                    />
                  </div>
                  <div className="col-lg-2">
                    <NumberInput
                      label="SMTP port"
                      value={emailDraft.smtpPort}
                      onChange={(value) => setEmailDraft({ ...emailDraft, smtpPort: value })}
                    />
                  </div>
                  <div className="col-lg-3">
                    <SelectInput
                      label="SMTP security"
                      value={emailDraft.smtpSecurity}
                      options={['SSL_TLS', 'STARTTLS', 'NONE']}
                      onChange={(value) =>
                        setEmailDraft({
                          ...emailDraft,
                          smtpSecurity: value as EmailDraft['smtpSecurity'],
                        })
                      }
                    />
                  </div>
                  <div className="col-lg-3">
                    <SecretInput
                      label={emailDraft.passwordSet ? 'Password set' : 'Password'}
                      onChange={(value) => setEmailDraft({ ...emailDraft, password: value })}
                    />
                  </div>
                  <div className="col-lg-4">
                    <TextInput
                      label="From address"
                      value={emailDraft.fromAddress}
                      onChange={(value) =>
                        setEmailDraft({ ...emailDraft, fromAddress: value })
                      }
                    />
                  </div>
                  <div className="col-lg-4">
                    <TextInput
                      label="From name"
                      value={emailDraft.fromName ?? ''}
                      onChange={(value) =>
                        setEmailDraft({ ...emailDraft, fromName: value || null })
                      }
                    />
                  </div>
                  <div className="col-lg-2">
                    <NumberInput
                      label="Poll batch"
                      value={emailDraft.pollBatchSize}
                      onChange={(value) =>
                        setEmailDraft({ ...emailDraft, pollBatchSize: value })
                      }
                    />
                  </div>
                  <div className="col-lg-2">
                    <NumberInput
                      label="Rate/min"
                      value={emailDraft.ratePerMinute}
                      onChange={(value) =>
                        setEmailDraft({ ...emailDraft, ratePerMinute: value })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <CardFooter busy={saving === 'email'} />
          </form>
        </div>
      </div>
    </>
  );
}

function ChannelStatus({
  enabled,
  health,
  detail,
}: {
  enabled: boolean;
  health: string;
  detail: string;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between border rounded p-3 mb-3">
      <div>
        <span className={`badge ${enabled ? 'bg-success' : 'bg-secondary'}`}>
          {enabled ? 'enabled' : 'disabled'}
        </span>
        <span className="badge bg-light text-dark ms-2">{health}</span>
      </div>
      <span className="text-muted small">{detail}</span>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-label w-100 mb-3">
      <span>{label}</span>
      <input
        className="form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SecretInput({
  label,
  onChange,
}: {
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-label w-100 mb-3">
      <span>{label}</span>
      <input
        className="form-control"
        type="password"
        autoComplete="new-password"
        placeholder="Leave blank to keep current value"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="form-label w-100 mb-3">
      <span>{label}</span>
      <input
        className="form-control"
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(toNumber(event.target.value, value))}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-label w-100 mb-3">
      <span>{label}</span>
      <select
        className="form-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="form-check form-switch mb-3">
      <input
        className="form-check-input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        id={`toggle-${label.replace(/\s+/g, '-').toLowerCase()}`}
      />
      <label
        className="form-check-label"
        htmlFor={`toggle-${label.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {label}
      </label>
    </div>
  );
}

function CardFooter({ busy }: { busy: boolean }) {
  return (
    <div className="card-footer text-end">
      <button className="btn btn-primary" type="submit" disabled={busy}>
        <i className="ti ti-device-floppy me-1"></i>
        {busy ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
