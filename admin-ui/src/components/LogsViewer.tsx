export default function LogsViewer() {
  const logs = [
    { time: '14:22:01', level: 'INFO', msg: 'System initialized' },
    { time: '14:22:15', level: 'INFO', msg: 'Gateway connected to Telegram' },
    { time: '14:23:10', level: 'WARN', msg: 'Rate limit approaching on model provider' },
    { time: '14:25:00', level: 'INFO', msg: 'Task completed successfully' },
  ];

  return (
    <div className="logs-viewer">
      <h2>Activity Logs</h2>
      <div className="log-container">
        {logs.map((log, idx) => (
          <div key={idx} className={`log-entry ${log.level.toLowerCase()}`}>
            <span className="log-time">[{log.time}]</span>
            <span className="log-level">[{log.level}]</span>
            <span className="log-msg">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
