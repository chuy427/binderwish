import { useEffect, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import Hero from './home/Hero';
import HowItWorks from './home/HowItWorks';
import { Anatomy, Compare, FeatureTiles, FinalCta } from './home/Sections';
import VendorSection from './VendorSection';
import SiteFootnote from './SiteFootnote';
import { useRotation, useShowcase } from './home/useShowcase';
import { GAME_LIST } from '../games';

// The landing page. Its visuals (hero binder, stickers, how-it-works, feature
// tiles, sample placeholder, vendor display case) rotate between games using
// real cards and live prices; the search in the hero has its own game picker.
export default function HomePage({ setsByGame, loadGameSets, onStart, onPrivacy }) {
  const [heroHover, setHeroHover] = useState(false);
  const [featured, setFeatured] = useRotation(GAME_LIST.length, { interval: 8000, paused: heroHover });
  const featuredId = GAME_LIST[featured].id;
  const showcase = useShowcase(featuredId, setsByGame[featuredId]);

  // Load every game's set list so each showcase is ready when it rotates in.
  useEffect(() => { GAME_LIST.forEach((g) => loadGameSets(g.id)); }, [loadGameSets]);

  const startTool = () => onStart({ game: featuredId, set: null, query: '' });

  return (
    <Box>
      <Hero
        setsByGame={setsByGame}
        loadGameSets={loadGameSets}
        onStart={onStart}
        showcase={showcase}
        featured={featured}
        onFeature={setFeatured}
        onHover={setHeroHover}
      />
      <HowItWorks showcase={showcase} />
      <FeatureTiles showcase={showcase} onStart={startTool} />
      <Anatomy showcase={showcase} />
      <Compare showcase={showcase} />
      <VendorSection showcase={showcase} onStart={startTool} />
      <FinalCta onStart={startTool} />

      <Container maxWidth="lg" component="footer" sx={{ py: 4 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          <SiteFootnote onPrivacy={onPrivacy} />
        </Typography>
      </Container>
    </Box>
  );
}
