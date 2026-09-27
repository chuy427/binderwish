import { useEffect, useRef, useState } from 'react';
import PlaceholderCard from './PlaceholderCard';
import { setSlots } from '../api';

const PER_PAGE = 9; // one 9-pocket binder page

// Lays the print sheet out in binder order, 9 per page, then opens the print dialog.
//  - keepPositions: each page mirrors a real binder page of the set's full slot
//    list; slots not being printed stay blank so placeholders drop straight in.
//  - newPagePerSet: each set starts on a fresh page.
async function buildPages(queue, options, setsInfo) {
  const bySet = new Map();
  for (const item of queue) {
    if (!bySet.has(item.setId)) bySet.set(item.setId, []);
    bySet.get(item.setId).push(item);
  }
  const pages = [];
  let loose = [];
  for (const [setId, items] of bySet) {
    items.sort((a, b) => a.order - b.order);
    const setName = items[0].setName;
    if (options.keepPositions) {
      const all = await setSlots(setId, setsInfo, { variants: options.variants }).catch(() => null);
      if (all?.length) {
        const wanted = new Map(items.map((i) => [i.key, i]));
        for (let p = 0; p * PER_PAGE < all.length; p++) {
          const cells = all.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map((s) => wanted.get(s.key) || null);
          // Skip binder pages with nothing to print — the page number keeps its place.
          if (cells.some(Boolean)) pages.push({ cells, caption: `${setName} · binder page ${p + 1}` });
        }
        const placed = new Set(all.map((s) => s.key));
        const extra = items.filter((i) => !placed.has(i.key));
        if (extra.length) loose.push(...extra);
        continue;
      }
    }
    const copies = items.flatMap((i) => Array(i.qty).fill(i));
    if (options.newPagePerSet) {
      for (let p = 0; p * PER_PAGE < copies.length; p++) {
        pages.push({ cells: copies.slice(p * PER_PAGE, (p + 1) * PER_PAGE), caption: `${setName} · sheet ${p + 1}` });
      }
    } else {
      loose.push(...copies);
    }
  }
  for (let p = 0; p * PER_PAGE < loose.length; p++) {
    pages.push({ cells: loose.slice(p * PER_PAGE, (p + 1) * PER_PAGE), caption: '' });
  }
  return pages;
}

export default function PrintArea({ queue, options, setsInfo, onDone }) {
  const ref = useRef(null);
  const [pages, setPages] = useState(null);

  useEffect(() => {
    let cancelled = false;
    buildPages(queue, options, setsInfo).then((p) => { if (!cancelled) setPages(p); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once laid out, wait for the art to load so the print isn't blank.
  useEffect(() => {
    if (!pages) return;
    let cancelled = false;
    const imgs = [...ref.current.querySelectorAll('img')];
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))))
      .then(() => {
        if (cancelled) return;
        window.addEventListener('afterprint', onDone, { once: true });
        window.print();
      });
    return () => { cancelled = true; };
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className="print-only">
      {(pages || []).map((page, i) => (
        <div key={i} className={`sheet${options.cutLines ? ' cutlines' : ''}`}>
          <div className="sheet-grid" style={{ gap: `${options.gap}mm` }}>
            {page.cells.map((slot, j) => (slot
              ? <PlaceholderCard key={j} slot={slot} options={options} highRes />
              : <div key={j} className="pcard blank" />))}
          </div>
          {page.caption && <div className="sheet-caption">BinderWish · {page.caption}</div>}
        </div>
      ))}
    </div>
  );
}
