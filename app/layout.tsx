import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Control de generadores',
  description: 'Dashboard para controlar movimientos y ubicaciones de generadores.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
