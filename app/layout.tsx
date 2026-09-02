import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: "Yuta's Lab — Healthcare AI Journey",
  description: 'Private learning tracker for a data science to Healthcare AI journey.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
