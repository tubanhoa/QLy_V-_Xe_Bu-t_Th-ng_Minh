/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:3001/uploads/:path*',
      },
    ]
  },
}

export default nextConfig
