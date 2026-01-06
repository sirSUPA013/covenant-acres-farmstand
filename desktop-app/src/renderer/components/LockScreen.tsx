import React, { useState, useEffect, useRef } from 'react';

// Assets
import logo from '../assets/logo.jpg';

interface AdminUser {
  id: string;
  name: string;
  role: 'developer' | 'owner' | 'admin';
  isDeveloper: boolean;
  isOwner: boolean;
}

interface LockScreenProps {
  onUnlock: (user: AdminUser) => void;
}

function LockScreen({ onUnlock }: LockScreenProps) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [secret, setSecret] = useState('');
  const [showDevSetup, setShowDevSetup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('Admin Portal');
  const [isPortable, setIsPortable] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkSetup();
    loadPublicSettings();
  }, []);

  async function loadPublicSettings() {
    try {
      const settings = await window.api.getPublicSettings();
      if (settings.businessName) {
        setBusinessName(settings.businessName);
      }
      setIsPortable(settings.isPortable || false);
    } catch (e) {
      // Use default if settings unavailable
    }
  }

  useEffect(() => {
    // Focus PIN input when ready
    if (needsSetup !== null && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [needsSetup]);

  async function checkSetup() {
    const result = await window.api.checkAdminSetup();
    setNeedsSetup(result.needsSetup);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    const result = await window.api.adminLogin(pin);
    setLoading(false);

    if (result.success && result.user) {
      onUnlock(result.user as AdminUser);
    } else {
      setError(result.error || 'Invalid PIN');
      setPin('');
      pinInputRef.current?.focus();
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError('');

    // If developer setup mode and secret provided, try developer setup
    if (showDevSetup && secret) {
      const result = await window.api.setupDeveloper(name.trim(), pin, secret);
      setLoading(false);

      if (result.success && result.user) {
        onUnlock(result.user as AdminUser);
      } else {
        setError(result.error || 'Developer setup failed');
      }
      return;
    }

    // Regular owner setup
    const result = await window.api.setupOwner(name.trim(), pin);
    setLoading(false);

    if (result.success && result.user) {
      onUnlock(result.user as AdminUser);
    } else {
      setError('Setup failed. Please try again.');
    }
  }

  function handlePinChange(value: string, setter: (v: string) => void) {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setter(digits);
    setError('');
  }

  if (needsSetup === null) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        {!isPortable && <img src={logo} alt={businessName} className="lock-logo" />}
        <h1 className="lock-title">{businessName}</h1>
        <p className="lock-subtitle">Admin Portal</p>

        {needsSetup ? (
          <form onSubmit={handleSetup} className="lock-form">
            <p className="setup-message">
              Welcome! Set up your {showDevSetup ? 'developer' : 'admin'} account.
            </p>

            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Create PIN (4-6 digits)</label>
              <input
                type="password"
                className="form-input pin-input"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="••••"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm PIN</label>
              <input
                type="password"
                className="form-input pin-input"
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                placeholder="••••"
                inputMode="numeric"
              />
            </div>

            {showDevSetup && (
              <div className="form-group">
                <label className="form-label">Developer Secret</label>
                <input
                  type="password"
                  className="form-input"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter developer secret"
                />
              </div>
            )}

            {error && <div className="lock-error">{error}</div>}

            <button type="submit" className="btn btn-primary lock-btn" disabled={loading}>
              {loading ? 'Setting up...' : showDevSetup ? 'Create Developer Account' : 'Create Account'}
            </button>

            <button
              type="button"
              className="dev-toggle"
              onClick={() => {
                setShowDevSetup(!showDevSetup);
                setSecret('');
                setError('');
              }}
            >
              {showDevSetup ? 'Standard Setup' : 'Developer Setup'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="lock-form">
            <div className="form-group">
              <label className="form-label">Enter PIN</label>
              <input
                ref={pinInputRef}
                type="password"
                className="form-input pin-input"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder="••••"
                inputMode="numeric"
                autoFocus
              />
            </div>

            {error && <div className="lock-error">{error}</div>}

            <button type="submit" className="btn btn-primary lock-btn" disabled={loading}>
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LockScreen;
