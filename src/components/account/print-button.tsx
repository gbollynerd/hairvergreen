'use client';
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm">Print / Save PDF</button>;
}
