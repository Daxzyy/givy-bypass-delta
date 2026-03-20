/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // GIVY_SECRET di-inject ke frontend saat build dari Vercel Env Vars
    NEXT_PUBLIC_GIVY_SECRET: process.env.GIVY_SECRET || '',
  },
};
module.exports = nextConfig;
