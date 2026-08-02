import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterCard } from '../components/CharacterCard';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { loadSession } from '../lib/roomUtils';
import type { Team } from '../types';

type Filter = 'all' | Team;

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'townsfolk', label: 'Townsfolk' },
  { value: 'outsider', label: 'Outsiders' },
  { value: 'minion', label: 'Minions' },
  { value: 'demon', label: 'Demons' },
];

export function CharacterReferencePage() {
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();
  const session = loadSession();

  const visible =
    filter === 'all'
      ? TROUBLE_BREWING
      : TROUBLE_BREWING.filter((c) => c.team === filter);

  return (
    <div className="page ref-page">
      <div className="ref-container">
        {/* Header */}
        <div className="ref-header">
          <button className="btn-back" onClick={() => navigate(session ? '/lobby' : '/')}>
            ← Back
          </button>
          <div>
            <h1 className="ref-title">Character Reference</h1>
            <p className="ref-subtitle">Trouble Brewing · {TROUBLE_BREWING.length} characters</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs" role="tablist">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? TROUBLE_BREWING.length
                : TROUBLE_BREWING.filter((c) => c.team === tab.value).length;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={filter === tab.value}
                className={`filter-tab${filter === tab.value ? ' active' : ''}`}
                onClick={() => setFilter(tab.value)}
              >
                {tab.label}
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Character grid */}
        <div className="character-grid">
          {visible.map((character) => (
            <div key={character.id} className="ref-card-wrapper">
              <CharacterCard character={character} />
              {/* Description shown below ability in reference mode */}
              <p className="ref-description">{character.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
