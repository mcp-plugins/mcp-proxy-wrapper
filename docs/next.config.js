const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx'
})

module.exports = withNextra({
  output: 'export',
  trailingSlash: true,
  basePath: '/mcp-proxy-wrapper',
  assetPrefix: '/mcp-proxy-wrapper',
  images: {
    unoptimized: true
  }
})