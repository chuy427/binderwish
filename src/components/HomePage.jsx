import { useEffect, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import Hero from './home/Hero';
import HowItWorks from './home/HowItWorks';
import { Anatomy, Compare, FeatureTiles, FinalCta } from './home/Sections';
import VendorSection from './VendorSection';
import SiteFootnote from './SiteFootnote';
import { useShowcase } from './home/useShowcase';
import { DEFAULT_GAME, GAME_LIST } from '../games';

// The landing page. Its visuals (hero binder, stickers, how-it-works, feature
// tiles, sample placeholder, vendor display case) use real cards and live prices
// from one game — Pokémon until the visitor picks another, with either the
// search's game toggle or the chips under the binder.
export default function HomePage({ setsByGame, loadGameSets, onStart, onPrivacy }) {
  const [featuredId, setFeaturedId] = useState(DEFAULT_GAME);
  const showcase = useShowcase(featuredId, setsByGame[featuredId]);

  // Load every game's set list so each showcase is ready when it's picked.
  useEffect(() => { GAME_LIST.forEach((g) => loadGameSets(g.id)); }, [loadGameSets]);

  const startTool = () => onStart({ game: featuredId, set: null, query: '' });

  return (
    <Box>
      <Hero
        setsByGame={setsByGame}
        loadGameSets={loadGameSets}
        onStart={onStart}
        showcase={showcase}
        gameId={featuredId}
        onGame={setFeaturedId}
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
