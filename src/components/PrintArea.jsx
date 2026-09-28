import { useEffect, useRef, useState } from 'react';
import PlaceholderCard from './PlaceholderCard';
import { setSlots } from '../catalog';
import { getGame } from '../games';

const PER_PAGE = 9; // one 9-pocket binder page

// Lays the print sheet out in binder order, 9 per page, then opens the print dialog.
//  - keepPositions: each page mirrors a real binder page of the set's full slot
//    list; slots not being printed stay blank so placeholders drop straight in.
//  - newPagePerSet: each set starts on a fresh page.
async function buildPages(queue, options, getSetsInfo) {
  // Group by game + set (a sheet can mix games; items saved before multi-game are Pokémon).
  const bySet = new Map();
  for (const item of queue) {
    const k = `${item.game || 'pokemon'}|${item.setId}`;
    if (!bySet.has(k)) bySet.set(k, []);
    bySet.get(k).push(item);
  }
  const pages = [];
  let loose = [];
  for (const [k, items] of bySet) {
    const [gameId, setId] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
    items.sort((a, b) => a.order - b.order);
    const setName = items[0].setName;
    if (options.keepPositions) {
      const game = getGame(gameId);
      const all = await getSetsInfo(gameId)
        .then((info) => setSlots(game, setId, info, { variants: options.variants }))
        .catch(() => null);
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

export default function PrintArea({ queue, options, getSetsInfo, onDone }) {
  const ref = useRef(null);
  const [pages, setPages] = useState(null);

  useEffect(() => {
    let cancelled = false;
    buildPages(queue, options, getSetsInfo).then((p) => { if (!cancelled) setPages(p); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once laid out, wait for the art to settle so the print isn't blank. A missing
  // image swaps to a fallback source (or the art-free design) after it fails, so
  // wait until every image is complete twice in a row, a moment apart (max ~15s).
  useEffect(() => {
    if (!pages) return;
    let cancelled = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const allComplete = () => [...ref.current.querySelectorAll('img')].every((img) => img.complete);
    (async () => {
      for (let i = 0; i < 60; i++) {
        await sleep(150);
        if (allComplete()) { await sleep(150); if (allComplete()) break; }
      }
      if (cancelled) return;
      window.addEventListener('afterprint', onDone, { once: true });
      window.print();
    })();
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
