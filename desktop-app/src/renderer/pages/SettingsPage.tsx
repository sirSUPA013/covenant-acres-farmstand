import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Settings {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  defaultCutoffHours: number;
  requirePaymentMethod: boolean;
  notificationEmail: boolean;
  notificationSms: boolean;
  notificationEmails: string; // JSON array of email addresses
  notificationPhones: string; // JSON array of phone numbers
  smsProvider: string;
  smsApiKey: string;
  emailProvider: string;
  emailApiKey: string;
  googleSheetsId: string;
  googleCredentials: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Payment links
  enablePrepayment: boolean;
  venmoUsername: string;
  cashappCashtag: string;
  paypalUsername: string;
  zelleEmail: string;
  // Time estimates for profit/hr calculation
  bakeDaySetupMinutes: number;
  bakeDayPerLoafMinutes: number;
  bakeDayCleanupMinutes: number;
  miscProductionPerLoafMinutes: number;
}

interface AdminUser {
  id: string;
  name: string;
  is_active: number;
  is_owner: number;
  is_developer: number;
  last_login: string | null;
  created_at: string;
}

interface AuditEntry {
  id: number;
  user_id: string | null;
  user_name: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>({
    businessName: 'Covenant Acres Farmstand',
    businessEmail: '',
    businessPhone: '',
    defaultCutoffHours: 48,
    requirePaymentMethod: false,
    notificationEmail: true,
    notificationSms: false,
    notificationEmails: '[]',
    notificationPhones: '[]',
    smsProvider: '',
    smsApiKey: '',
    emailProvider: '',
    emailApiKey: '',
    googleSheetsId: '',
    googleCredentials: '',
    quietHoursStart: '21:00',
    quietHoursEnd: '08:00',
    enablePrepayment: false,
    venmoUsername: '',
    cashappCashtag: '',
    paypalUsername: '',
    zelleEmail: '',
    bakeDaySetupMinutes: 60,
    bakeDayPerLoafMinutes: 8,
    bakeDayCleanupMinutes: 45,
    miscProductionPerLoafMinutes: 15,
  });

  // State for new recipient inputs
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'time' | 'payment' | 'notifications' | 'integrations' | 'users' | 'activity'>('general');
  const [syncStatus, setSyncStatus] = useState<{ lastSync: string | null; pendingChanges: number; isOnline: boolean }>({
    lastSync: null,
    pendingChanges: 0,
    isOnline: true,
  });

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; isOwner: boolean; isDeveloper: boolean } | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    loadSettings();
    loadSyncStatus();
    loadCurrentUser();

    // Listen for sync updates
    const unsubscribe = window.api.onSyncUpdate((status) => {
      setSyncStatus(status as typeof syncStatus);
    });

    return unsubscribe;
  }, []);

  // Load section-specific data when section changes
  useEffect(() => {
    if (activeSection === 'users') {
      loadAdminUsers();
    } else if (activeSection === 'activity') {
      loadAuditLog();
    }
  }, [activeSection]);

  async function loadSyncStatus() {
    try {
      const status = await window.api.getSyncStatus();
      setSyncStatus(status as typeof syncStatus);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }

  async function loadCurrentUser() {
    try {
      const user = await window.api.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  }

  async function loadAdminUsers() {
    try {
      const users = await window.api.getAdminUsers();
      setAdminUsers(users as AdminUser[]);
    } catch (error) {
      console.error('Failed to load admin users:', error);
    }
  }

  async function loadAuditLog() {
    try {
      const log = await window.api.getAuditLog({ limit: 100 });
      setAuditLog(log as AuditEntry[]);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }

  async function handleAddUser() {
    if (!newUserName.trim() || newUserPin.length < 4) {
      setMessage({ type: 'error', text: 'Name and PIN (4+ digits) required' });
      return;
    }

    const result = await window.api.createAdminUser(newUserName.trim(), newUserPin);
    if (result.success) {
      setMessage({ type: 'success', text: 'User created successfully' });
      setShowAddUser(false);
      setNewUserName('');
      setNewUserPin('');
      loadAdminUsers();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to create user' });
    }
  }

  async function handleToggleUserActive(user: AdminUser) {
    const result = await window.api.updateAdminUser(user.id, { isActive: !user.is_active });
    if (result.success) {
      loadAdminUsers();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update user' });
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;

    const result = await window.api.deleteAdminUser(user.id);
    if (result.success) {
      setMessage({ type: 'success', text: 'User deleted' });
      loadAdminUsers();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to delete user' });
    }
  }

  // Notification recipient helpers
  function getNotificationEmails(): string[] {
    try {
      return JSON.parse(settings.notificationEmails || '[]');
    } catch {
      return [];
    }
  }

  function getNotificationPhones(): string[] {
    try {
      return JSON.parse(settings.notificationPhones || '[]');
    } catch {
      return [];
    }
  }

  function addNotificationEmail() {
    if (!newEmail.trim()) return;
    const emails = getNotificationEmails();
    if (emails.includes(newEmail.trim())) {
      setMessage({ type: 'error', text: 'Email already added' });
      return;
    }
    emails.push(newEmail.trim());
    updateSetting('notificationEmails', JSON.stringify(emails));
    setNewEmail('');
  }

  function removeNotificationEmail(email: string) {
    const emails = getNotificationEmails().filter(e => e !== email);
    updateSetting('notificationEmails', JSON.stringify(emails));
  }

  function addNotificationPhone() {
    if (!newPhone.trim()) return;
    const phones = getNotificationPhones();
    if (phones.includes(newPhone.trim())) {
      setMessage({ type: 'error', text: 'Phone already added' });
      return;
    }
    phones.push(newPhone.trim());
    updateSetting('notificationPhones', JSON.stringify(phones));
    setNewPhone('');
  }

  function removeNotificationPhone(phone: string) {
    const phones = getNotificationPhones().filter(p => p !== phone);
    updateSetting('notificationPhones', JSON.stringify(phones));
  }

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

      // If Google Sheets credentials are provided, configure the sync
      if (settings.googleSheetsId && settings.googleCredentials) {
        try {
          const credentials = JSON.parse(settings.googleCredentials);
          await window.api.configureGoogleSheets(credentials, settings.googleSheetsId);
        } catch (parseError) {
          console.error('Invalid JSON credentials:', parseError);
          setMessage({ type: 'error', text: 'Invalid JSON in credentials. Check the format.' });
          setSaving(false);
          return;
        }
      }

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
            className={`settings-nav-item ${activeSection === 'time' ? 'active' : ''}`}
            onClick={() => setActiveSection('time')}
          >
            Time Estimates
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveSection('payment')}
          >
            Payment
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
          {currentUser?.isOwner && (
            <button
              className={`settings-nav-item ${activeSection === 'users' ? 'active' : ''}`}
              onClick={() => setActiveSection('users')}
            >
              Admin Users
            </button>
          )}
          <button
            className={`settings-nav-item ${activeSection === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveSection('activity')}
          >
            Activity Log
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

          {/* Time Estimates */}
          {activeSection === 'time' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Time Estimates</h2>
              </div>
              <p className="form-hint" style={{ marginBottom: '20px' }}>
                These estimates are used to calculate your profit per hour. Update them as your processes become more efficient.
              </p>

              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--primary-green)' }}>Bake Day Time</h3>
              <p className="form-hint" style={{ marginBottom: '16px' }}>
                Time spent on days when you have scheduled orders.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Setup Time (minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.bakeDaySetupMinutes}
                    onChange={(e) => updateSetting('bakeDaySetupMinutes', parseInt(e.target.value) || 0)}
                    min="0"
                    style={{ width: '120px' }}
                  />
                  <p className="form-hint">Time to prepare before baking (gathering ingredients, preheating, etc.)</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Time Per Loaf (minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.bakeDayPerLoafMinutes}
                    onChange={(e) => updateSetting('bakeDayPerLoafMinutes', parseInt(e.target.value) || 0)}
                    min="0"
                    style={{ width: '120px' }}
                  />
                  <p className="form-hint">Average hands-on time per loaf during a bake day</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cleanup Time (minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.bakeDayCleanupMinutes}
                  onChange={(e) => updateSetting('bakeDayCleanupMinutes', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{ width: '120px' }}
                />
                <p className="form-hint">Time to clean up after baking is done</p>
              </div>

              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--primary-green)' }}>Misc Production Time</h3>
              <p className="form-hint" style={{ marginBottom: '16px' }}>
                Time spent on extra production (walk-in sales, gifts, etc.) made outside of scheduled bake days.
              </p>

              <div className="form-group">
                <label className="form-label">Time Per Loaf (minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.miscProductionPerLoafMinutes}
                  onChange={(e) => updateSetting('miscProductionPerLoafMinutes', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{ width: '120px' }}
                />
                <p className="form-hint">Average time per loaf for small batches (typically higher than bake day time)</p>
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
                <strong style={{ color: '#0369a1' }}>Example Calculation</strong>
                <p style={{ marginTop: '8px', color: '#0369a1', fontSize: '0.875rem' }}>
                  For a bake day with 20 loaves:<br />
                  {settings.bakeDaySetupMinutes} min setup + ({settings.bakeDayPerLoafMinutes} min × 20 loaves) + {settings.bakeDayCleanupMinutes} min cleanup = {settings.bakeDaySetupMinutes + (settings.bakeDayPerLoafMinutes * 20) + settings.bakeDayCleanupMinutes} minutes ({((settings.bakeDaySetupMinutes + (settings.bakeDayPerLoafMinutes * 20) + settings.bakeDayCleanupMinutes) / 60).toFixed(1)} hours)
                </p>
              </div>
            </div>
          )}

          {/* Payment Settings */}
          {activeSection === 'payment' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Payment Links</h2>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.enablePrepayment}
                    onChange={(e) => updateSetting('enablePrepayment', e.target.checked)}
                  />
                  <span>Enable prepayment options on order form</span>
                </label>
                <p className="form-hint">
                  When enabled, customers will see payment links after placing an order so they can pay in advance.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Venmo Username</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#666' }}>@</span>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.venmoUsername}
                    onChange={(e) => updateSetting('venmoUsername', e.target.value)}
                    placeholder="YourVenmoUsername"
                  />
                </div>
                <p className="form-hint">
                  Your Venmo username (without the @). Leave blank to hide Venmo option.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Cash App Cashtag</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#666' }}>$</span>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.cashappCashtag}
                    onChange={(e) => updateSetting('cashappCashtag', e.target.value)}
                    placeholder="YourCashtag"
                  />
                </div>
                <p className="form-hint">
                  Your Cash App cashtag (without the $). Leave blank to hide Cash App option.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">PayPal Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.paypalUsername}
                  onChange={(e) => updateSetting('paypalUsername', e.target.value)}
                  placeholder="YourPayPalUsername"
                />
                <p className="form-hint">
                  Your PayPal.me username. Leave blank to hide PayPal option.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Zelle Email/Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.zelleEmail}
                  onChange={(e) => updateSetting('zelleEmail', e.target.value)}
                  placeholder="pay@youremail.com"
                />
                <p className="form-hint">
                  The email or phone number registered with your Zelle account. Leave blank to hide Zelle option.
                </p>
              </div>

              {settings.enablePrepayment && (
                <div className="form-group" style={{ marginTop: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '8px' }}>Preview</h4>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
                    Customers will see these payment options after placing an order:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                    {settings.venmoUsername && <li>Venmo: @{settings.venmoUsername}</li>}
                    {settings.cashappCashtag && <li>Cash App: ${settings.cashappCashtag}</li>}
                    {settings.paypalUsername && <li>PayPal: paypal.me/{settings.paypalUsername}</li>}
                    {settings.zelleEmail && <li>Zelle: {settings.zelleEmail}</li>}
                    {!settings.venmoUsername && !settings.cashappCashtag && !settings.paypalUsername && !settings.zelleEmail && (
                      <li style={{ color: '#999' }}>No payment methods configured</li>
                    )}
                  </ul>
                </div>
              )}

              <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />

              <h3 style={{ marginBottom: '16px' }}>Order Management</h3>
              <div className="form-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.requirePaymentMethod}
                    onChange={(e) => updateSetting('requirePaymentMethod', e.target.checked)}
                  />
                  <span>Require payment method when marking orders as paid</span>
                </label>
                <p className="form-hint">
                  When enabled, you must select a payment method (cash, Venmo, etc.) before marking an order as paid.
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

              <h3 style={{ marginBottom: '16px' }}>Owner Notification Recipients</h3>
              <p className="form-hint mb-lg">
                Add email addresses and phone numbers to receive notifications when new orders are placed.
              </p>

              {/* Email Recipients */}
              <div className="form-group">
                <label className="form-label">Email Addresses</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="email"
                    className="form-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email address"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNotificationEmail())}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addNotificationEmail}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
                {getNotificationEmails().length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getNotificationEmails().map((email) => (
                      <span
                        key={email}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: '#e8f5e9',
                          borderRadius: '16px',
                          fontSize: '0.9rem',
                        }}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => removeNotificationEmail(email)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            fontSize: '1rem',
                            lineHeight: 1,
                            color: '#666',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone Recipients */}
              <div className="form-group">
                <label className="form-label">Phone Numbers (for SMS)</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="tel"
                    className="form-input"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Enter phone number"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNotificationPhone())}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addNotificationPhone}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
                {getNotificationPhones().length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getNotificationPhones().map((phone) => (
                      <span
                        key={phone}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: '#e3f2fd',
                          borderRadius: '16px',
                          fontSize: '0.9rem',
                        }}
                      >
                        {phone}
                        <button
                          type="button"
                          onClick={() => removeNotificationPhone(phone)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            fontSize: '1rem',
                            lineHeight: 1,
                            color: '#666',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                {!currentUser?.isDeveloper && !currentUser?.isOwner && (
                  <span style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                    View only — contact owner to modify
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Google Sheets ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.googleSheetsId}
                  onChange={(e) => updateSetting('googleSheetsId', e.target.value)}
                  placeholder="From the spreadsheet URL"
                  disabled={!currentUser?.isDeveloper && !currentUser?.isOwner}
                  style={!currentUser?.isDeveloper && !currentUser?.isOwner ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
                />
                <p className="form-hint">
                  Find this in your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Service Account Credentials (JSON)</label>
                <textarea
                  className="form-textarea"
                  value={currentUser?.isDeveloper || currentUser?.isOwner ? settings.googleCredentials : (settings.googleCredentials ? '••••••••••••••••••••' : '')}
                  onChange={(e) => updateSetting('googleCredentials', e.target.value)}
                  placeholder={currentUser?.isDeveloper || currentUser?.isOwner ? "Paste your service account JSON credentials here" : "Credentials hidden"}
                  rows={6}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    ...((!currentUser?.isDeveloper && !currentUser?.isOwner) ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {})
                  }}
                  disabled={!currentUser?.isDeveloper && !currentUser?.isOwner}
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
                  <span>
                    {syncStatus.lastSync
                      ? new Date(syncStatus.lastSync).toLocaleString()
                      : 'Never'}
                  </span>
                </p>
                <p>
                  <strong>Pending Changes:</strong>{' '}
                  <span>{syncStatus.pendingChanges}</span>
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span style={{ color: syncStatus.isOnline ? '#2e7d32' : '#c62828' }}>
                    {syncStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Admin Users */}
          {activeSection === 'users' && (currentUser?.isDeveloper || currentUser?.isOwner) && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Admin Users</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => navigate('/users')}>
                    Manage Permissions
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>
                    Add User
                  </button>
                </div>
              </div>

              {showAddUser && (
                <div className="add-user-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PIN (4-6 digits)</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newUserPin}
                        onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={handleAddUser}>
                      Create User
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setShowAddUser(false); setNewUserName(''); setNewUserPin(''); }}>
                      Cancel
                    </button>
                  </div>
                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #eee' }} />
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.is_developer ? 'Developer' : user.is_owner ? 'Owner' : 'Admin'}</td>
                      <td>
                        {user.last_login
                          ? new Date(user.last_login).toLocaleString()
                          : 'Never'}
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_active ? 'status-paid' : 'status-canceled'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {!user.is_owner && !user.is_developer && (
                          <>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => handleToggleUserActive(user)}
                              style={{ marginRight: '4px' }}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-small btn-danger"
                              onClick={() => handleDeleteUser(user)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {(user.is_owner || user.is_developer) && <span style={{ color: '#666' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activity Log */}
          {activeSection === 'activity' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Activity Log</h2>
                <button className="btn btn-secondary" onClick={loadAuditLog}>
                  Refresh
                </button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td>{entry.user_name}</td>
                      <td>
                        <span className="action-badge">{entry.action}</span>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: '#666' }}>
                        {entry.details || '—'}
                      </td>
                    </tr>
                  ))}
                  {auditLog.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#666' }}>
                        No activity recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
        .add-user-form {
          background: var(--light-gray);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .action-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #e3f2fd;
          color: #1565c0;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

export default SettingsPage;
