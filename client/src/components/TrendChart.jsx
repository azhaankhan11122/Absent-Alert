export default function TrendChart({ points }) {
  const width = 720;
  const height = 230;
  const pad = 34;
  const values = points.length ? points : [{ date: 'No data', attendancePercent: 0, absent: 0 }];
  const maxAbsent = Math.max(1, ...values.map((p) => p.absent));
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const line = values.map((p, i) => {
    const x = pad + i * step;
    const y = height - pad - ((p.attendancePercent || 0) / 100) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Attendance trend chart">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="axis" />
      {values.map((p, i) => {
        const x = pad + i * step;
        const barH = (p.absent / maxAbsent) * 70;
        return <rect key={p.date} x={x - 10} y={height - pad - barH} width="20" height={barH} rx="5" className="absent-bar" />;
      })}
      <polyline points={line} fill="none" className="trend-line" />
      {values.map((p, i) => {
        const x = pad + i * step;
        const y = height - pad - ((p.attendancePercent || 0) / 100) * (height - pad * 2);
        return <circle key={`${p.date}-dot`} cx={x} cy={y} r="5" className="dot"><title>{`${p.date}: ${p.attendancePercent}% attendance, ${p.absent} absent`}</title></circle>;
      })}
      <text x={pad} y="20" className="chart-label">Attendance % line • Absent count bars</text>
    </svg>
  );
}
