import { useEffect, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import Hero from './home/Hero';
import HowItWorks from './home/HowItWorks';
import { Anatomy, Compare, FinalCta } from './home/Sections';
import FeatureGrid from './home/FeatureGrid';
import VendorSection, { VendorSteps } from './VendorSection';
import AudienceSwitch from './home/AudienceSwitch';
import SiteFootnote from './SiteFootnote';
import { useShowcase } from './home/useShowcase';
import { DEFAULT_GAME, GAME_LIST } from '../games';

// The landing page. Its visuals (hero binder, stickers, how-it-works, feature
// tiles, sample placeholder, vendor display case) use real cards and live prices
// from one game — Pokémon until the visitor picks another, with either the
// search's game toggle or the chips under the binder.
export default function HomePage({ setsByGame, loadGameSets, onStart, onPrivacy, onVendorWaitlist, onGo, signedIn, onSignIn }) {
  const [featuredId, setFeaturedId] = useState(DEFAULT_GAME);
  const showcase = useShowcase(featuredId, setsByGame[featuredId]);
  // Collector or vendor story below the hero. Vendors can be sent straight to
  // theirs with <base>?for=vendors.
  const [audience, setAudienceState] = useState(() =>
    new URLSearchParams(location.search).get('for') === 'vendors' ? 'vendor' : 'collector');
  const setAudience = (a) => {
    setAudienceState(a);
    const url = new URL(location.href);
    if (a === 'vendor') url.searchParams.set('for', 'vendors'); else url.searchParams.delete('for');
    history.replaceState(history.state, '', url);
  };
  const vendor = audience === 'vendor';

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
      <AudienceSwitch value={audience} onChange={setAudience} />
      {vendor ? (
        <Box key="vendor" className="bw-fade">
          <VendorSection showcase={showcase} onStart={startTool} onWaitlist={onVendorWaitlist} />
          <VendorSteps />
          <Anatomy showcase={showcase} vendor />
          <FinalCta onStart={startTool} vendor onWaitlist={onVendorWaitlist} />
        </Box>
      ) : (
        <Box key="collector" className="bw-fade">
          <FeatureGrid showcase={showcase} signedIn={signedIn}
            onGo={(where) => (where === 'signIn' && onSignIn ? onSignIn() : onGo(where === 'signIn' ? 'sets' : where, featuredId))} />
          <HowItWorks showcase={showcase} />
          <Anatomy showcase={showcase} />
          <Compare showcase={showcase} />
          <FinalCta onStart={() => onGo('sets', featuredId)} onSignIn={signedIn ? null : onSignIn} />
        </Box>
      )}

      <Container maxWidth="lg" component="footer" sx={{ py: 4 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          <SiteFootnote onPrivacy={onPrivacy} />
        </Typography>
      </Container>
    </Box>
  );
}
