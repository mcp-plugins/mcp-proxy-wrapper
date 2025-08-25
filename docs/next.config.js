const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx'
})

const isGitHubPages = process.env.NODE_ENV === 'production'

module.exports = withNextra({
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // GitHub Pages configuration with custom domain
  basePath: '',
  assetPrefix: '',
  // Ensure proper static file handling
  experimental: {
    esmExternals: false
  }
})