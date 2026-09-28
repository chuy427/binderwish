import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

// Fades/slides its children in the first time they scroll into view.
export default function Reveal({ children, delay = 0, sx, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Box ref={ref} className={`bw-reveal${visible ? ' is-visible' : ''}`} sx={{ transitionDelay: `${delay}ms`, ...sx }} {...rest}>
      {children}
    </Box>
  );
}
