import { useEffect, useRef } from 'react';
import ProxyCard from './ProxyCard';

// Rendered only while printing: lays cards out 9 per page, waits for the
// high-res art to load, then opens the print dialog.
export default function PrintArea({ queue, options, onDone }) {
  const ref = useRef(null);
  const cards = queue.flatMap((c) => Array(c.qty).fill(c));
  const sheets = [];
  for (let i = 0; i < cards.length; i += 9) sheets.push(cards.slice(i, i + 9));

  useEffect(() => {
    let cancelled = false;
    const imgs = [...ref.current.querySelectorAll('img')];
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))))
      .then(() => {
        if (cancelled) return;
        window.addEventListener('afterprint', onDone, { once: true });
        window.print();
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="print-only">
      {sheets.map((sheet, i) => (
        <div key={i} className={`sheet${options.cutLines ? ' cutlines' : ''}`} style={{ gap: `${options.gap}mm` }}>
          {sheet.map((card, j) => <ProxyCard key={j} card={card} options={options} highRes />)}
        </div>
      ))}
    </div>
  );
}
