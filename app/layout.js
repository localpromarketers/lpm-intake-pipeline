import './globals.css';

export const metadata = {
  title: 'Local Pro Marketers | Client Intake',
  description: 'Tell us about your business and we\'ll build your website.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
