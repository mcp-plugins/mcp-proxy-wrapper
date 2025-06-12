import type { MDXComponents } from 'mdx/types'
import { useMDXComponents as getBaseMDXComponents } from 'nextra-theme-docs'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...getBaseMDXComponents(components),
    ...components,
  }
}