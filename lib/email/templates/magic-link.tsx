/**
 * Magic-link email template.
 *
 * Rendered to HTML at send time via `render()` from react-email. The same
 * component is previewable via the react-email dev server (`pnpm email:dev`)
 * during template iteration.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  render,
  Section,
  Text,
} from 'react-email'

interface MagicLinkEmailProps {
  url: string
}

function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your AIG sign-in link — expires in 15 minutes.</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section>
            <Text style={brandStyle}>AIG · Arcade Intent Graph</Text>
            <Text style={headingStyle}>Sign in to your workspace</Text>
            <Text style={paragraphStyle}>
              Click the button below to sign in. This link expires in 15 minutes and can only be
              used once.
            </Text>
            <Section style={buttonContainerStyle}>
              <Button href={url} style={buttonStyle}>
                Sign in to AIG
              </Button>
            </Section>
            <Text style={paragraphStyle}>
              Or copy and paste this URL into your browser:
              <br />
              <span style={urlStyle}>{url}</span>
            </Text>
            <Hr style={hrStyle} />
            <Text style={footerStyle}>
              If you didn't request this email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function renderMagicLinkHtml(props: MagicLinkEmailProps): Promise<string> {
  return render(<MagicLinkEmail {...props} />)
}

export function renderMagicLinkText(props: MagicLinkEmailProps): Promise<string> {
  return render(<MagicLinkEmail {...props} />, { plainText: true })
}

const bodyStyle = {
  backgroundColor: '#0a0a0a',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,sans-serif',
  margin: 0,
  padding: '40px 0',
}

const containerStyle = {
  backgroundColor: '#111111',
  border: '1px solid #262626',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '40px 32px',
}

const brandStyle = {
  color: '#7c83ff',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '11px',
  letterSpacing: '0.16em',
  margin: 0,
  textTransform: 'uppercase' as const,
}

const headingStyle = {
  color: '#fafafa',
  fontSize: '28px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
  margin: '8px 0 24px',
}

const paragraphStyle = {
  color: '#a3a3a3',
  fontSize: '15px',
  lineHeight: 1.6,
  margin: '0 0 16px',
}

const buttonContainerStyle = {
  margin: '24px 0',
}

const buttonStyle = {
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  color: '#0a0a0a',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 500,
  padding: '12px 24px',
  textDecoration: 'none',
}

const urlStyle = {
  color: '#737373',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
}

const hrStyle = {
  borderColor: '#262626',
  margin: '32px 0 16px',
}

const footerStyle = {
  color: '#737373',
  fontSize: '13px',
  lineHeight: 1.5,
  margin: 0,
}
