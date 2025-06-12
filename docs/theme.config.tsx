import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span>🔌 MCP Proxy Wrapper</span>,
  project: {
    link: 'https://github.com/crazyrabbitltc/mcp-proxy-wrapper',
  },
  chat: {
    link: 'https://discord.gg/mcp-community',
  },
  docsRepositoryBase: 'https://github.com/crazyrabbitltc/mcp-proxy-wrapper/tree/main/docs',
  footer: {
    text: '© 2024 MCP Proxy Wrapper. Built with Nextra.',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – MCP Proxy Wrapper'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="MCP Proxy Wrapper" />
      <meta property="og:description" content="A powerful proxy wrapper for Model Context Protocol (MCP) servers with hooks and plugin system" />
    </>
  ),
  banner: {
    key: 'stripe-plugin-launch',
    text: (
      <a href="/plugins/stripe-monetization" target="_blank">
        🎉 New: Stripe Monetization Plugin is now available! →
      </a>
    )
  },
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <div style={{ background: 'currentColor', height: '1px' }} />
      }
      return <>🔌 {title}</>
    }
  },
  toc: {
    backToTop: true
  }
}

export default config