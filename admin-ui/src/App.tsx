import { useState } from 'react';
import './App.css';
import LogsViewer from './components/LogsViewer';
import SkillManager from './components/SkillManager';

function App() {
  const [activeTab, setActiveTab] = useState('logs');

  return (
    <div className="admin-dashboard">
      <header className="header">
        <h1>🦞 Herclew Admin</h1>
        <div className="status-badge online">Gateway Online</div>
      </header>
      
      <div className="main-content">
        <aside className="sidebar">
          <nav>
            <button 
              className={activeTab === 'logs' ? 'active' : ''} 
              onClick={() => setActiveTab('logs')}
            >
              Activity Logs
            </button>
            <button 
              className={activeTab === 'skills' ? 'active' : ''} 
              onClick={() => setActiveTab('skills')}
            >
              Skill Manager
            </button>
          </nav>
        </aside>
        
        <main className="content-area">
          {activeTab === 'logs' && <LogsViewer />}
          {activeTab === 'skills' && <SkillManager />}
        </main>
      </div>
    </div>
  );
}

export default App;
