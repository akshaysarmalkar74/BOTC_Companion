import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/roomUtils';
import type { Room } from '../types';

type ResumeState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'in_progress'; room: Room; isHost: boolean }
  | { kind: 'completed'; room: Room };

export function LandingPage() {
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeState>({ kind: 'loading' });

  useEffect(() => {
    async function checkSession() {
      const session = loadSession();
      if (!session) {
        setResume({ kind: 'none' });
        return;
      }

      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, code, status, script, host_id, phase, night_step_key, outcome, ended_at, created_at')
        .eq('id', session.roomId)
        .single();

      if (!roomData) {
        clearSession();
        setResume({ kind: 'none' });
        return;
      }

      const room = roomData as Room;

      if (room.status === 'in_progress') {
        if (!session.isHost) {
          // Non-host players reconnect automatically
          navigate('/game');
          return;
        }
        setResume({ kind: 'in_progress', room, isHost: true });
      } else if (room.status === 'completed') {
        setResume({ kind: 'completed', room });
      } else {
        // lobby — go back to lobby
        navigate('/lobby');
      }
    }

    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    clearSession();
    setResume({ kind: 'none' });
  };

  if (resume.kind === 'loading') {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page centered">
      <div className="landing-card">
        <h1 className="landing-title">Blood on the Clocktower</h1>
        <p className="landing-subtitle">Companion</p>

        {/* Resume banner */}
        {resume.kind === 'in_progress' && (
          <div className="resume-banner resume-banner-active">
            <div className="resume-banner-info">
              <span className="resume-banner-label">Game in progress</span>
              <span className="resume-banner-detail">Room {resume.room.code} · {resume.room.phase}</span>
            </div>
            <div className="resume-banner-actions">
              <button
                className="btn btn-primary resume-btn"
                onClick={() => navigate('/game')}
              >
                Resume
              </button>
              <button className="btn-link resume-dismiss" onClick={handleDismiss}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {resume.kind === 'completed' && (
          <div className="resume-banner resume-banner-completed">
            <div className="resume-banner-info">
              <span className="resume-banner-label">Previous game ended</span>
              <span className="resume-banner-detail">
                Room {resume.room.code} ·{' '}
                {resume.room.outcome === 'good'   ? 'Good won'
                : resume.room.outcome === 'evil'  ? 'Evil won'
                : 'Cancelled'}
              </span>
            </div>
            <div className="resume-banner-actions">
              <button
                className="btn btn-secondary resume-btn"
                onClick={() => navigate('/history')}
              >
                View History
              </button>
              <button className="btn-link resume-dismiss" onClick={handleDismiss}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="landing-actions">
          <button className="btn btn-primary btn-large" onClick={() => navigate('/create')}>
            Create Room
          </button>
          <button className="btn btn-secondary btn-large" onClick={() => navigate('/join')}>
            Join Room
          </button>
          <button
            className="btn-link landing-settings-link"
            onClick={() => navigate('/settings')}
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
