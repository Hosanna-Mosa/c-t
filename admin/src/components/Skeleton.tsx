export function Skeleton({ className = '', width, height, style = {} }: { className?: string; width?: string | number; height?: string | number; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        ...style,
      }}
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <table className="table">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <Skeleton height="16px" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex}>
                <Skeleton height="16px" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton height="24px" width="60%" style={{ marginBottom: '12px' }} />
      <Skeleton height="16px" width="80%" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="70%" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: 'var(--border)' }}>
        <Skeleton width="24px" height="24px" />
      </div>
      <div className="stat-content" style={{ flex: 1 }}>
        <Skeleton height="14px" width="80px" style={{ marginBottom: '8px' }} />
        <Skeleton height="28px" width="120px" style={{ marginBottom: '8px' }} />
        <Skeleton height="12px" width="60px" />
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card">
      <Skeleton height="200px" style={{ marginBottom: '12px', borderRadius: '8px' }} />
      <Skeleton height="20px" width="80%" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="60%" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="40%" />
    </div>
  );
}
