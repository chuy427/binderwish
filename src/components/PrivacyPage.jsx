import { Box, Container, Link, Typography } from '@mui/material';

// Where people send access/removal requests. Set before publishing the waitlist.
export const CONTACT_EMAIL = 'hello@binderwish.com'; // forwarded to the owner's inbox (Cloudflare Email Routing)
const EFFECTIVE_DATE = 'October 8, 2026';

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
        BinderWish is a free tool for tracking trading card master sets and printing binder placeholders. We’ve kept it simple: accounts
        are optional, and there are no ads and no tracking cookies — just cookie-free visit counts. This page explains the little data that is involved.
      </P>

      <H>Data that stays in your browser</H>
      <P>
        If you don’t sign in, your owned-card checklist, print sheet and print settings are saved only in your
        browser’s local storage, along with cached card data to make the site faster. This data never leaves your
        device — we don’t receive it and can’t see it. Clearing your browser’s site data deletes it. Backup files you
        export are created on your device and stay wherever you save them.
      </P>

      <H>Optional accounts</H>
      <P>
        If you sign in, we store your email address and your collection — the owned-card checklist, print sheet and
        print settings (including any QR logo you’ve added) — so it can sync between your devices. Sign-in works by
        an emailed link; there’s no password. We use your email only to sign you in and to send messages about your
        account, never for marketing unless you separately join the waitlist.
      </P>
      <P>
        Accounts are hosted by <Link href="https://supabase.com/privacy" target="_blank" rel="noopener">Supabase</Link>,
        which stores the data for us, and your browser keeps a sign-in token in local storage so you stay signed in.
        Your collection is protected so that only your account can read or change it. Signing out removes your
        collection from that browser (it stays in your account). You can delete your account at any time from the
        account menu, which permanently deletes your email and collection.
      </P>

      <H>Price alerts</H>
      <P>
        If you set a price alert, we store the card and the target price with your account, check it once a day against
        TCGPlayer market prices, and email you (from noreply@binderwish.com, sent through{' '}
        <Link href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener">Resend</Link>) when the price is
        reached. Every alert email has a link to turn alert emails off. Deleting an alert — or your account — deletes it.
      </P>

      <H>The printing waitlist</H>
      <P>
        If you join the “Get them printed” waitlist, we collect your email address and, if you provide them, roughly
        how many placeholders you’d order and which games you collect. If you sign up as a vendor or shop, we also
        collect your business name (optional), where you sell, and which vendor features interest you. We use this
        only to tell you when printed placeholders or vendor features are available, to judge how much interest
        there is, and — for vendors — possibly to email you a question or two about what would help you. We don’t sell it, share it for marketing,
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
        <li><b>Cloudflare</b> hosts the site and provides Web Analytics: privacy-first visit counts (which pages are viewed, the referring site, country and device type) with no cookies and nothing that identifies you or follows you across sites (<Link href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare’s privacy policy</Link>).</li>
        <li><b>TCGdex</b> (Pokémon) and <b>Lorcast</b> (Lorcana) provide card lists, search and images. Your searches are sent to them to get results.</li>
        <li><b>TCGPlayer</b>: its image servers supply One Piece card images, and you visit TCGPlayer itself when you open a card link or scan a placeholder’s QR code (<Link href="https://www.tcgplayer.com/privacy-policy" target="_blank" rel="noopener">TCGPlayer’s privacy policy</Link>).</li>
        <li><b>Supabase</b>, only if you sign in, to store and sync your account (and any price alerts).</li>
        <li><b>Resend</b> delivers sign-in and price alert emails, only if you sign in.</li>
        <li><b>Formspree</b>, only if you submit the waitlist form.</li>
      </Box>
      <P>
        BinderWish doesn’t currently earn money from TCGPlayer links. If we add affiliate links in the future, we’ll
        update this page.
      </P>

      <H>Children</H>
      <P>
        BinderWish isn’t directed at children under 13, and we don’t knowingly collect their personal information. If
        you’re under 13, please don’t create an account or join the waitlist — ask a parent or guardian instead. If
        you believe a child has signed up, email <Contact /> and we’ll delete it.
      </P>

      <H>Your choices</H>
      <P>
        You can delete your account yourself from the account menu. You can also ask us what account or waitlist
        information we have about you, or ask us to delete it, at any time by emailing <Contact />.
      </P>

      <H>Changes</H>
      <P>If this policy changes, we’ll update this page and the effective date above.</P>
    </Container>
  );
}
