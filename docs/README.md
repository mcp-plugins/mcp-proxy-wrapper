# MCP Proxy Wrapper Documentation

This is a [Nextra](https://nextra.site/) documentation site built with Next.js.

## Development

To run the documentation site locally:

```bash
npm run dev
```

This will start the development server on http://localhost:3000 (or next available port).

## Building

To build the documentation for production:

```bash
npm run build
```

## Deployment

The documentation is configured to work with static site hosting. The `.nojekyll` file ensures GitHub Pages doesn't try to process files with Jekyll.

## Content

All documentation content is in the `pages/` directory as `.mdx` files:

- `pages/index.mdx` - Homepage
- `pages/getting-started.mdx` - Getting started guide  
- `pages/api-reference.mdx` - Complete API documentation
- `pages/examples.mdx` - Usage examples
- `pages/plugins/` - Plugin documentation
- etc.

The site navigation and configuration is defined in `theme.config.tsx`.