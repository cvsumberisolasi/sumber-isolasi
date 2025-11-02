/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
  serverActions: {
    bodySizeLimit: '10mb',
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

export default pwaConfig(nextConfig);
