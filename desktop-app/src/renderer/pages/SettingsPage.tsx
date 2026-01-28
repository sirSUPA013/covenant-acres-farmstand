import { useState, useEffect } from 'react';
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
  const [activeSection, setActiveSection] = useState<'general' | 'time' | 'payment' | 'notifications' | 'integrations' | 'users' | 'activity' | 'help'>('general');
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
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
      const response = await window.api.getAuditLog({ limit: 100 });
      setAuditLog((response.data || []) as AuditEntry[]);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }

  async function handleAddUser() {
    if (!newUserName.trim() || newUserPin.length < 4) {
      setMessage({ type: 'error', text: 'Name and PIN (4+ digits) required' });
      return;
    }

    const result = await window.api.createAdminUser({ name: newUserName.trim(), pin: newUserPin, role: 'staff' });
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
          <div style={{ borderTop: '1px solid #ddd', margin: '8px 0' }} />
          <button
            className={`settings-nav-item ${activeSection === 'help' ? 'active' : ''}`}
            onClick={() => setActiveSection('help')}
          >
            Help & Guides
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

          {/* Help & Guides */}
          {activeSection === 'help' && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Help & Guides</h2>
              </div>
              <p style={{ marginBottom: '16px', color: '#666' }}>
                Click any section below to learn how to use that part of the system.
              </p>

              {/* Overview */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'overview' ? null : 'overview')}
                >
                  <span>System Overview</span>
                  <span>{expandedGuide === 'overview' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'overview' && (
                  <div className="guide-content">
                    <p><strong>Covenant Acres Farmstand</strong> helps you manage bread orders from start to finish:</p>
                    <ol>
                      <li><strong>Customers order</strong> through your online order form</li>
                      <li><strong>You plan</strong> what to bake using the Prep Sheet</li>
                      <li><strong>You track</strong> what was actually baked in Production</li>
                      <li><strong>Customers pick up</strong> and you mark orders complete</li>
                    </ol>
                    <p style={{ marginTop: '12px' }}>The main tabs are:</p>
                    <ul>
                      <li><strong>Orders</strong> - See and manage all customer orders</li>
                      <li><strong>Prep Sheet</strong> - Plan your bake days</li>
                      <li><strong>Production</strong> - Track loaves after baking</li>
                      <li><strong>Analytics</strong> - See sales and profit data</li>
                      <li><strong>Recipes</strong> - Manage recipes and ingredients</li>
                      <li><strong>Config</strong> - Set up pickup slots, flavors, locations</li>
                      <li><strong>Settings</strong> - Business info, payments, this help section</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Orders Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'orders' ? null : 'orders')}
                >
                  <span>Orders Tab</span>
                  <span>{expandedGuide === 'orders' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'orders' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> View and manage all customer orders.</p>

                    <h4>Order Statuses</h4>
                    <ul>
                      <li><strong>Submitted</strong> - New order, not yet on a prep sheet</li>
                      <li><strong>Scheduled</strong> - Added to a prep sheet for baking</li>
                      <li><strong>Baked</strong> - Prep sheet completed, loaves ready</li>
                      <li><strong>Picked Up</strong> - Customer got their order</li>
                      <li><strong>Canceled</strong> - Order was canceled</li>
                      <li><strong>No Show</strong> - Customer didn't pick up</li>
                    </ul>

                    <h4>Common Tasks</h4>
                    <ul>
                      <li><strong>View order details:</strong> Click any order row</li>
                      <li><strong>Filter orders:</strong> Use the dropdowns at the top</li>
                      <li><strong>Edit an order:</strong> Click the order, then "Edit Order"</li>
                      <li><strong>Export to CSV:</strong> Click the export button for spreadsheet</li>
                    </ul>

                    <h4>Notes</h4>
                    <p>Payment status is shown here but edited in the Production tab (where you'll be when customers pick up).</p>
                  </div>
                )}
              </div>

              {/* Prep Sheet Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'prep' ? null : 'prep')}
                >
                  <span>Prep Sheet Tab</span>
                  <span>{expandedGuide === 'prep' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'prep' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> Plan what you're going to bake each day.</p>

                    <h4>Workflow</h4>
                    <ol>
                      <li><strong>Create a prep sheet</strong> for your bake date</li>
                      <li><strong>Add orders</strong> - Select which customer orders to include</li>
                      <li><strong>Add extras</strong> - Plan additional loaves beyond orders (for walk-ins, gifts, etc.)</li>
                      <li><strong>View the summary</strong> - See total loaves by flavor</li>
                      <li><strong>Print or view ingredients</strong> - Get your shopping/prep list</li>
                      <li><strong>Mark complete</strong> - When baking is done, this creates production records</li>
                    </ol>

                    <h4>Prep Sheet Statuses</h4>
                    <ul>
                      <li><strong>Draft</strong> - Still planning, can add/remove items</li>
                      <li><strong>Completed</strong> - Baking done, loaves moved to Production tab</li>
                    </ul>

                    <h4>Tips</h4>
                    <ul>
                      <li>You can adjust actual quantities when marking complete (if you baked more or fewer than planned)</li>
                      <li>Orders on a prep sheet show as "Scheduled" in the Orders tab</li>
                      <li>When you complete a prep sheet, order statuses update to "Baked"</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Production Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'production' ? null : 'production')}
                >
                  <span>Production Tab</span>
                  <span>{expandedGuide === 'production' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'production' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> Track what happens to every loaf after it's baked.</p>

                    <h4>Where Loaves Come From</h4>
                    <p>When you complete a prep sheet, all the loaves appear here automatically.</p>

                    <h4>Loaf Statuses</h4>
                    <ul>
                      <li><strong>Pending</strong> - Baked, waiting for pickup or sale</li>
                      <li><strong>Picked Up</strong> - Customer got their pre-ordered loaves</li>
                      <li><strong>Sold</strong> - Extra loaf sold to walk-in customer</li>
                      <li><strong>Gifted</strong> - Given away (neighbor, thank-you, etc.)</li>
                      <li><strong>Wasted</strong> - Had to throw away (burnt, dropped, etc.)</li>
                      <li><strong>Personal</strong> - Kept for your family</li>
                    </ul>

                    <h4>Payment Tracking</h4>
                    <p>For pre-orders, update payment status here when customers pick up:</p>
                    <ul>
                      <li>Click the payment dropdown on the order card</li>
                      <li>Select the payment method they used</li>
                      <li>This updates the order record automatically</li>
                    </ul>

                    <h4>Splitting Loaves</h4>
                    <p>If you need to track different outcomes for the same batch:</p>
                    <ul>
                      <li>Click "Split" on any line item</li>
                      <li>Example: 3 extra loaves → 2 sold + 1 gifted</li>
                    </ul>

                    <h4>Views</h4>
                    <ul>
                      <li><strong>Grouped by Order</strong> - See all loaves for each customer together</li>
                      <li><strong>Flat View</strong> - See every loaf as a separate row</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Analytics Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'analytics' ? null : 'analytics')}
                >
                  <span>Analytics Tab</span>
                  <span>{expandedGuide === 'analytics' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'analytics' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> Understand your sales, costs, and profitability.</p>

                    <h4>Key Reports</h4>
                    <ul>
                      <li><strong>Profit by Flavor</strong> - Which breads make the most money</li>
                      <li><strong>Profit by Pickup Day</strong> - How each bake day performed</li>
                      <li><strong>Profit per Hour</strong> - Your effective hourly wage</li>
                      <li><strong>Sales Trends</strong> - Revenue over time</li>
                    </ul>

                    <h4>How Costs Are Calculated</h4>
                    <p>Recipe cost = sum of all ingredient costs (based on your ingredient library)</p>
                    <p>Total cost = recipe cost + overhead (packaging + utilities per loaf)</p>
                    <p>Profit = selling price − total cost</p>

                    <h4>Tips</h4>
                    <ul>
                      <li>Use the date range filter to see specific periods</li>
                      <li>Keep your ingredient costs updated for accurate profit tracking</li>
                      <li>Set your time estimates in Settings → Time & Labor for profit/hour</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Recipes Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'recipes' ? null : 'recipes')}
                >
                  <span>Recipes Tab</span>
                  <span>{expandedGuide === 'recipes' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'recipes' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> Manage your bread recipes and calculate costs.</p>

                    <h4>Recipe Structure</h4>
                    <ul>
                      <li><strong>Base Ingredients</strong> - Main dough ingredients</li>
                      <li><strong>Fold-ins</strong> - Add-ins mixed into the dough (cheese, herbs, etc.)</li>
                      <li><strong>Lamination</strong> - Butter or fillings for layered breads</li>
                      <li><strong>Steps</strong> - Your process instructions</li>
                    </ul>

                    <h4>Ingredient Library</h4>
                    <p>Your ingredients are stored with their costs. When you add an ingredient to a recipe:</p>
                    <ol>
                      <li>Select from your library (or add new)</li>
                      <li>Enter the quantity your recipe uses</li>
                      <li>Choose the unit (grams, cups, etc.)</li>
                      <li>Cost is calculated automatically</li>
                    </ol>

                    <h4>Unit Conversion Warning</h4>
                    <p>If you see a ⚠️ warning on an ingredient cost, it means:</p>
                    <ul>
                      <li>The recipe uses a different unit type than how it's purchased</li>
                      <li>Example: Recipe uses cups, but you buy it by weight</li>
                      <li>Fix: Edit the ingredient and add "Weight per Volume" measurement</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Config Tab */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'config' ? null : 'config')}
                >
                  <span>Config Tab</span>
                  <span>{expandedGuide === 'config' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'config' && (
                  <div className="guide-content">
                    <p><strong>Purpose:</strong> Set up the building blocks customers choose from.</p>

                    <h4>Pickup Slots</h4>
                    <p>These are the dates/times customers can pick up orders:</p>
                    <ul>
                      <li>Create a slot for each pickup day</li>
                      <li>Set the location, date, and capacity</li>
                      <li>Set cutoff hours (when ordering closes)</li>
                      <li>Close slots when full or no longer available</li>
                    </ul>

                    <h4>Flavors</h4>
                    <p>Your bread varieties that customers can order:</p>
                    <ul>
                      <li>Name, description, and price</li>
                      <li>Link to a recipe for cost calculation</li>
                      <li>Set as seasonal to hide from order form</li>
                    </ul>

                    <h4>Locations</h4>
                    <p>Where customers pick up (farmers market, farm, etc.):</p>
                    <ul>
                      <li>Name and address</li>
                      <li>Used when creating pickup slots</li>
                    </ul>

                    <h4>Ingredients</h4>
                    <p>Your ingredient library with costs:</p>
                    <ul>
                      <li>Package price and size (what you pay)</li>
                      <li>Cost per unit is calculated automatically</li>
                      <li>Add "Weight per Volume" for accurate recipe costing</li>
                    </ul>

                    <h4>Overhead Costs</h4>
                    <p>Per-loaf costs beyond ingredients:</p>
                    <ul>
                      <li>Packaging (bags, labels, etc.)</li>
                      <li>Utilities (oven gas/electric, etc.)</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Common Workflows */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'workflows' ? null : 'workflows')}
                >
                  <span>Common Workflows</span>
                  <span>{expandedGuide === 'workflows' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'workflows' && (
                  <div className="guide-content">
                    <h4>Weekly Bake Day Workflow</h4>
                    <ol>
                      <li><strong>Before bake day:</strong> Go to Prep Sheet, create sheet for your bake date</li>
                      <li><strong>Add orders:</strong> Select all orders for that pickup day</li>
                      <li><strong>Add extras:</strong> Plan extra loaves for walk-ins</li>
                      <li><strong>Review:</strong> Check ingredient quantities, print if needed</li>
                      <li><strong>Bake:</strong> Do your thing!</li>
                      <li><strong>After baking:</strong> Mark prep sheet complete (adjust quantities if needed)</li>
                      <li><strong>Pickup day:</strong> Go to Production tab</li>
                      <li><strong>As customers arrive:</strong> Update payment status, mark loaves as picked up</li>
                      <li><strong>End of day:</strong> Mark remaining extras as sold/gifted/personal</li>
                    </ol>

                    <h4>Setting Up a New Pickup Day</h4>
                    <ol>
                      <li>Go to Config → Pickup Slots</li>
                      <li>Click "+ Add Slot"</li>
                      <li>Select location, date, time</li>
                      <li>Set capacity (max loaves)</li>
                      <li>Set cutoff hours before pickup</li>
                      <li>Save - it's now available on your order form!</li>
                    </ol>

                    <h4>Adding a New Bread Flavor</h4>
                    <ol>
                      <li>Go to Config → Flavors</li>
                      <li>Click "+ Add Flavor"</li>
                      <li>Enter name, description, price</li>
                      <li>Save the flavor</li>
                      <li>Go to Recipes tab</li>
                      <li>Create recipe, link to the new flavor</li>
                      <li>Add ingredients for cost tracking</li>
                    </ol>

                    <h4>When a Customer Cancels</h4>
                    <ol>
                      <li>Go to Orders tab</li>
                      <li>Find and click the order</li>
                      <li>Click "Edit Order"</li>
                      <li>Change status to "Canceled"</li>
                      <li>If already on prep sheet, remove it or adjust extras</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Troubleshooting */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'trouble' ? null : 'trouble')}
                >
                  <span>Troubleshooting</span>
                  <span>{expandedGuide === 'trouble' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'trouble' && (
                  <div className="guide-content">
                    <h4>Recipe costs show ⚠️ warning</h4>
                    <p><strong>Cause:</strong> Recipe uses volume (cups) but ingredient is priced by weight (grams), or vice versa.</p>
                    <p><strong>Fix:</strong> Go to Config → Ingredients, edit the ingredient, add "Weight per Volume" (measure 1 tsp/tbsp/cup and weigh it).</p>

                    <h4>Order form not showing new pickup slots</h4>
                    <p><strong>Check:</strong></p>
                    <ul>
                      <li>Slot isn't marked as "Closed"</li>
                      <li>Date hasn't passed</li>
                      <li>Cutoff time hasn't passed</li>
                      <li>Capacity isn't full</li>
                    </ul>

                    <h4>Can't edit payment on an order</h4>
                    <p><strong>By design:</strong> Payment is edited in the Production tab, not Orders. This is because you'll typically update payment when customers pick up.</p>

                    <h4>Profit numbers seem wrong</h4>
                    <p><strong>Check:</strong></p>
                    <ul>
                      <li>Recipe ingredients have costs assigned</li>
                      <li>No ⚠️ warnings on ingredient costs</li>
                      <li>Overhead costs are set (Settings → Time & Labor)</li>
                      <li>Flavor is linked to a recipe</li>
                    </ul>

                    <h4>Need more help?</h4>
                    <p>Submit feedback or report issues through our feedback portal (see below), or contact Sam directly.</p>
                  </div>
                )}
              </div>

              {/* Feedback & Support */}
              <div className="guide-section">
                <button
                  className="guide-header"
                  onClick={() => setExpandedGuide(expandedGuide === 'feedback' ? null : 'feedback')}
                  style={{ backgroundColor: '#e3f2fd' }}
                >
                  <span>Feedback & Support</span>
                  <span>{expandedGuide === 'feedback' ? '−' : '+'}</span>
                </button>
                {expandedGuide === 'feedback' && (
                  <div className="guide-content">
                    <p>We want to hear from you! Your feedback helps make this app better.</p>

                    <h4>Submit Feedback</h4>
                    <p>Use our feedback portal to:</p>
                    <ul>
                      <li><strong>Report bugs</strong> - Something not working right?</li>
                      <li><strong>Request features</strong> - Have an idea for improvement?</li>
                      <li><strong>Ask questions</strong> - Need clarification on anything?</li>
                    </ul>

                    <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => window.api.openExternal('https://feedback.sjforge.dev/')}
                        style={{
                          backgroundColor: '#4caf50',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Open Feedback Portal
                      </button>
                      <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#666' }}>
                        Opens in your web browser
                      </p>
                    </div>

                    <h4>How to Submit Good Feedback</h4>
                    <p><strong>For bugs:</strong></p>
                    <ul>
                      <li>Describe what you were trying to do</li>
                      <li>Describe what happened instead</li>
                      <li>Include screenshots if possible</li>
                      <li>Note any error messages you saw</li>
                    </ul>

                    <p style={{ marginTop: '12px' }}><strong>For feature requests:</strong></p>
                    <ul>
                      <li>Describe the problem you're trying to solve</li>
                      <li>Explain how you currently work around it</li>
                      <li>Describe your ideal solution</li>
                    </ul>

                    <h4>Response Time</h4>
                    <p>Sam reviews feedback regularly. Urgent issues are prioritized, and you'll be notified when your feedback is addressed.</p>

                    <h4>Other Ways to Reach Us</h4>
                    <p>For urgent issues, you can also contact Sam directly. The feedback portal is preferred for tracking purposes.</p>
                  </div>
                )}
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
        .guide-section {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 8px;
          overflow: hidden;
        }
        .guide-header {
          width: 100%;
          padding: 14px 16px;
          background: #fafafa;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1rem;
          font-weight: 500;
          color: #333;
          transition: background 0.2s;
        }
        .guide-header:hover {
          background: #f0f0f0;
        }
        .guide-content {
          padding: 16px;
          background: white;
          border-top: 1px solid #e0e0e0;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .guide-content h4 {
          margin-top: 16px;
          margin-bottom: 8px;
          color: #8B7355;
          font-size: 0.95rem;
        }
        .guide-content h4:first-child {
          margin-top: 0;
        }
        .guide-content ul, .guide-content ol {
          margin: 8px 0;
          padding-left: 24px;
        }
        .guide-content li {
          margin-bottom: 4px;
        }
        .guide-content p {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}

export default SettingsPage;
