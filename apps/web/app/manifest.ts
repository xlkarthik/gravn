import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gravn — Train, Track & Improve',
    short_name: 'Gravn',
    description: 'High-precision strength training, splits, and coaching.',
    start_url: '/home',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#08090C',
    theme_color: '#08090C',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
