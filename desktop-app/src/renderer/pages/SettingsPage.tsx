import React, { useState, useEffect } from 'react';

interface Settings {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  defaultCutoffHours: number;
  notificationEmail: boolean;
  notificationSms: boolean;
  smsProvider: string;
  smsApiKey: string;
  emailProvider: string;
  emailApiKey: string;
  googleSheetsId: string;
  googleCredentials: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    businessName: 'Covenant Acres Farmstand',
    businessEmail: '',
    businessPhone: '',
    defaultCutoffHours: 48,
    notificationEmail: true,
    notificationSms: false,
    smsProvider: '',
    smsApiKey: '',
    emailProvider: '',
    emailApiKey: '',
    googleSheetsId: '',
    googleCredentials: '',
    quietHoursStart: '21:00',
    quietHoursEnd: '08:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'notifications' | 'integrations'>('general');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await window.api.getSettings();
      if (data) {
        setSettings({ ...settings, ...(data as Partial<Settings>) });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      await window.api.saveSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }
    setSaving(false);
  }

  async function testGoogleConnection() {
    try {
      const result = await window.api.testGoogleConnection();
      if (result) {
        setMessage({ type: 'success', text: 'Successfully connected to Google Sheets!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to connect. Check your credentials.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed.' });
    }
  }

  async function syncNow() {
    try {
      setMessage({ type: 'success', text: 'Sync started...' });
      await window.api.triggerSync();
      setMessage({ type: 'success', text: 'Sync completed successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Sync failed. Check your connection.' });
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings({ ...settings, [key]: value });
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
        </div>
        <div className="card">
          <div className="loading">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-layout">
        {/* Sidebar Navigation */}
        <div className="settings-nav">
          <button
            className={`settings-nav-item ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            General
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveSection('notifications')}
          >
            Notifications
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'integrations' ? 'active' : ''}`}
            onClick={() => setActiveSection('integrations')}
          >
            Integrations
          </button>
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">General Settings</h2>
              </div>

              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.businessName}
                  onChange={(e) => updateSetting('businessName', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Business Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={settings.businessEmail}
                    onChange={(e) => updateSetting('businessEmail', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Business Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={settings.businessPhone}
                    onChange={(e) => updateSetting('businessPhone', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Order Cutoff (hours before bake day)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.defaultCutoffHours}
                  onChange={(e) => updateSetting('defaultCutoffHours', parseInt(e.target.value))}
                  min="1"
                  max="168"
                  style={{ width: '120px' }}
                />
                <p className="form-hint">
                  Orders will be locked this many hours before the bake day. Default: 48 hours (2 days).
                </p>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Notification Settings</h2>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.notificationEmail}
                    onChange={(e) => updateSetting('notificationEmail', e.target.checked)}
                  />
                  <span>Enable Email Notifications</span>
                </label>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.notificationSms}
                    onChange={(e) => updateSetting('notificationSms', e.target.checked)}
                  />
                  <span>Enable SMS Notifications</span>
                </label>
              </div>

              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />

              <h3 style={{ marginBottom: '16px' }}>Quiet Hours</h3>
              <p className="form-hint mb-lg">
                Notifications will be held and sent after quiet hours end.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={settings.quietHoursStart}
                    onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={settings.quietHoursEnd}
                    onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                  />
                </div>
              </div>

              {settings.notificationSms && (
                <>
                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <h3 style={{ marginBottom: '16px' }}>SMS Configuration</h3>

                  <div className="form-group">
                    <label className="form-label">SMS Provider</label>
                    <select
                      className="form-select"
                      value={settings.smsProvider}
                      onChange={(e) => updateSetting('smsProvider', e.target.value)}
                    >
                      <option value="">Select a provider...</option>
                      <option value="twilio">Twilio</option>
                      <option value="vonage">Vonage</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      value={settings.smsApiKey}
                      onChange={(e) => updateSetting('smsApiKey', e.target.value)}
                      placeholder="Enter your SMS provider API key"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Integration Settings */}
          {activeSection === 'integrations' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Google Sheets Integration</h2>
              </div>

              <div className="form-group">
                <label className="form-label">Google Sheets ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.googleSheetsId}
                  onChange={(e) => updateSetting('googleSheetsId', e.target.value)}
                  placeholder="From the spreadsheet URL"
                />
                <p className="form-hint">
                  Find this in your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Service Account Credentials (JSON)</label>
                <textarea
                  className="form-textarea"
                  value={settings.googleCredentials}
                  onChange={(e) => updateSetting('googleCredentials', e.target.value)}
                  placeholder="Paste your service account JSON credentials here"
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={testGoogleConnection}>
                  Test Connection
                </button>
                <button className="btn btn-primary" onClick={syncNow}>
                  Sync Now
                </button>
              </div>

              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />

              <h3 style={{ marginBottom: '16px' }}>Sync Status</h3>
              <div className="sync-info">
                <p>
                  <strong>Last Sync:</strong>{' '}
                  <span id="last-sync-time">Checking...</span>
                </p>
                <p>
                  <strong>Pending Changes:</strong>{' '}
                  <span id="pending-changes">0</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .settings-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 24px;
        }
        .settings-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .settings-nav-item {
          background: none;
          border: none;
          padding: 12px 16px;
          text-align: left;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-gray);
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        .settings-nav-item:hover {
          background: var(--light-gray);
          color: var(--dark-gray);
        }
        .settings-nav-item.active {
          background: var(--primary-green);
          color: white;
        }
        .settings-content {
          min-height: 400px;
        }
        .message {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-weight: 500;
        }
        .message-success {
          background: #c8e6c9;
          color: #1b5e20;
        }
        .message-error {
          background: #ffebee;
          color: #c62828;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }
        .toggle-label input {
          width: 18px;
          height: 18px;
        }
        .form-hint {
          font-size: 0.875rem;
          color: var(--text-gray);
          margin-top: 4px;
        }
        .sync-info p {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

export default SettingsPage;
