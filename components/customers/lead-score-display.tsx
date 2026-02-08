'use client';

interface LeadScoreDisplayProps {
  score: number | null | undefined;
  lastUpdate?: string | null;
  className?: string;
  showBreakdown?: boolean;
}

export function LeadScoreDisplay({
  score,
  lastUpdate,
  className = '',
  showBreakdown = false,
}: LeadScoreDisplayProps) {
  if (score === null || score === undefined) {
    return (
      <div className={`text-base text-text-secondary ${className}`}>
        <div className="flex items-center gap-2">
          <span>Lead Score:</span>
          <span className="text-text-secondary">Not calculated yet</span>
        </div>
      </div>
    );
  }

  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const percentage = normalizedScore;

  // Color coding based on score
  let colorClass = '';
  let label = '';
  if (normalizedScore >= 71) {
    colorClass = 'bg-green-500';
    label = 'High';
  } else if (normalizedScore >= 31) {
    colorClass = 'bg-yellow-500';
    label = 'Medium';
  } else {
    colorClass = 'bg-red-500';
    label = 'Low';
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-base">
        <span className="font-semibold text-text-primary">Lead Score</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
            normalizedScore >= 71 ? 'bg-green-50 text-green-700' :
            normalizedScore >= 31 ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-700'
          }`}>
            {label}
          </span>
          <span className="font-semibold text-text-primary">{Math.round(normalizedScore)}/100</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-bg-secondary rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {lastUpdate && (
        <div className="text-sm text-text-secondary">
          Last updated: {new Date(lastUpdate).toLocaleString()}
        </div>
      )}

      {showBreakdown && (
        <div className="mt-2 rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">
          <div className="mb-2 font-semibold text-text-primary">Score breakdown</div>
          <div className="space-y-1">
            <div>Score is calculated from:</div>
            <ul className="list-disc list-inside ml-2 space-y-0.5">
              <li>Engagement (messages, session duration)</li>
              <li>Sentiment analysis</li>
              <li>Actions taken (tool calls, bookings)</li>
              <li>Response time</li>
              <li>Session quality</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}