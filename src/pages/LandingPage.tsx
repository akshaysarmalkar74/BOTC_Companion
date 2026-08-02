import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="page centered">
      <div className="landing-card">
        <h1 className="landing-title">Blood on the Clocktower</h1>
        <p className="landing-subtitle">Companion</p>
        <div className="landing-actions">
          <button className="btn btn-primary btn-large" onClick={() => navigate('/create')}>
            Create Room
          </button>
          <button className="btn btn-secondary btn-large" onClick={() => navigate('/join')}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
