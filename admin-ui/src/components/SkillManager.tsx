import { useState } from 'react';

export default function SkillManager() {
  const [skills, setSkills] = useState([
    { id: 1, name: 'daemon-watchdog', category: 'devops', active: true },
    { id: 2, name: 'auto-deploy', category: 'devops', active: false },
    { id: 3, name: 'paper-summarizer', category: 'research', active: true },
    { id: 4, name: 'github', category: 'integrations', active: true },
  ]);

  const toggleSkill = (id: number) => {
    setSkills(skills.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  return (
    <div className="skill-manager">
      <h2>Skill Manager</h2>
      <div className="skill-list">
        {skills.map(skill => (
          <div key={skill.id} className="skill-card">
            <div className="skill-info">
              <h3>{skill.name}</h3>
              <span className="skill-category">{skill.category}</span>
            </div>
            <button 
              className={`toggle-btn ${skill.active ? 'active' : ''}`}
              onClick={() => toggleSkill(skill.id)}
            >
              {skill.active ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
