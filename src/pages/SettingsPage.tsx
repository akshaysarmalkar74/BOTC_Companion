import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CONFIRM_KEY = 'botc_confirm_destructive';

function getConfirmPref(): boolean {
  return localStorage.getItem(CONFIRM_KEY) !== 'false';
}

function setConfirmPref(value: boolean) {
  localStorage.setItem(CONFIRM_KEY, String(value));
}

/** Read from anywhere to check if destructive confirmations are enabled. */
export function shouldConfirmDestructive(): boolean {
  return getConfirmPref();
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [confirmDestructive, setConfirmDestructive] = useState(getConfirmPref);

  function handleToggle() {
    const next = !confirmDestructive;
    setConfirmDestructive(next);
    setConfirmPref(next);
  }

  return (
    <div className="page centered">
      <div className="form-card settings-card">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="settings-title">Settings</h1>

        <div className="settings-section">
          <h2 className="settings-section-title">Gameplay</h2>

          <label className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Confirm destructive actions</span>
              <span className="settings-row-hint">
                Show a confirmation dialog before ending a game or starting a rematch.
              </span>
            </div>
            <button
              role="switch"
              aria-checked={confirmDestructive}
              className={`toggle-switch${confirmDestructive ? ' on' : ''}`}
              onClick={handleToggle}
            >
              <span className="toggle-knob" />
            </button>
          </label>
        </div>

        <div className="settings-section settings-section-about">
          <h2 className="settings-section-title">About</h2>
          <p className="settings-about-text">
            Blood on the Clocktower Companion<br />
            Trouble Brewing Edition
          </p>
        </div>
      </div>
    </div>
  );
}
