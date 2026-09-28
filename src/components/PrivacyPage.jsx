import { Box, Container, Link, Typography } from '@mui/material';

// Where people send access/removal requests. Set before publishing the waitlist.
export const CONTACT_EMAIL = 'chuy427jg@gmail.com';
const EFFECTIVE_DATE = 'September 28, 2026';

function Contact() {
  return CONTACT_EMAIL
    ? <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
    : <Box component="span" sx={{ bgcolor: 'warning.light', px: 0.5, borderRadius: 0.5 }}>[contact email — not set yet]</Box>;
}

function H({ children }) {
  return <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1 }}>{children}</Typography>;
}
function P({ children }) {
  return <Typography sx={{ mb: 1.5, color: 'text.secondary' }}>{children}</Typography>;
}

export default function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>Privacy policy</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>Effective {EFFECTIVE_DATE}</Typography>

      <P>
        BinderWish is a free tool for printing binder placeholders for trading cards. We’ve kept it simple: no
        accounts, no ads, no analytics and no tracking cookies. This page explains the little data that is involved.
      </P>

      <H>Data that stays in your browser</H>
      <P>
        Your owned-card checklist, print sheet and print settings are saved in your browser’s local storage, along
        with cached card data to make the site faster. This data never leaves your device — we don’t receive it and
        can’t see it. Clearing your browser’s site data deletes it. Backup files you export are created on your device
        and stay wherever you save them.
      </P>

      <H>The printing waitlist</H>
      <P>
        If you join the “Get them printed” waitlist, we collect your email address and, if you provide them, roughly
        how many placeholders you’d order and which games you collect. We use this only to tell you when printed
        placeholders are available and to judge how much interest there is. We don’t sell it, share it for marketing,
        or add you to any other mailing list.
      </P>
      <P>
        Signups are processed and stored by our form provider, <Link href="https://formspree.io/legal/privacy-policy" target="_blank" rel="noopener">Formspree</Link>,
        and forwarded to us by email. We keep them until the printing service launches (or we decide not to launch
        it), and delete them sooner if you ask. To be removed, email <Contact />.
      </P>

      <H>Services your browser connects to</H>
      <P>Using BinderWish means your browser loads content from these services, which can see your IP address and browser details, like any website:</P>
      <Box component="ul" sx={{ color: 'text.secondary', mt: 0, pl: 3, '& li': { mb: 1 } }}>
        <li><b>GitHub Pages</b> hosts the site (<Link href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub’s privacy statement</Link>).</li>
        <li><b>TCGdex</b> (Pokémon) and <b>Lorcast</b> (Lorcana) provide card lists, search and images. Your searches are sent to them to get results.</li>
        <li><b>TCGPlayer</b>: its image servers supply One Piece card images, and you visit TCGPlayer itself when you open a card link or scan a placeholder’s QR code (<Link href="https://www.tcgplayer.com/privacy-policy" target="_blank" rel="noopener">TCGPlayer’s privacy policy</Link>).</li>
        <li><b>Formspree</b>, only if you submit the waitlist form.</li>
      </Box>
      <P>
        BinderWish doesn’t currently earn money from TCGPlayer links. If we add affiliate links in the future, we’ll
        update this page.
      </P>

      <H>Children</H>
      <P>
        BinderWish isn’t directed at children under 13, and we don’t knowingly collect their personal information. If
        you’re under 13, please don’t join the waitlist — ask a parent or guardian instead. If you believe a child has
        signed up, email <Contact /> and we’ll delete it.
      </P>

      <H>Your choices</H>
      <P>
        You can ask us what waitlist information we have about you, or ask us to delete it, at any time by emailing <Contact />.
      </P>

      <H>Changes</H>
      <P>If this policy changes, we’ll update this page and the effective date above.</P>
    </Container>
  );
}
