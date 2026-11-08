import { useEffect, useState } from 'react';

// Shown while /api/analyze is pending. Mounted per submission, so the count
// starts from zero each time.
export function SubmitStatus() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((current) => current + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="submit-status">
      <p role="status">
        분석하는 중 <span className="elapsed" aria-hidden="true">{seconds}초</span>
      </p>
      <p className="hint">보통 10초에서 1분쯤 걸려요. 이 창을 닫으면 결과를 받을 수 없어요.</p>
    </div>
  );
}
