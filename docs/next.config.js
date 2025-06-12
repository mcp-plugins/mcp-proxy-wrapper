import nextra from 'nextra'

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  }
})

export default withNextra({
  // Next.js config
  experimental: {
    optimizePackageImports: ['nextra-theme-docs']
  }
})