import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Generadores',
    short_name: 'Generadores',
    description: 'Control de movimientos y ubicaciones de generadores.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1219',
    theme_color: '#0f1219',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
