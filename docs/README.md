# MCP Proxy Wrapper Documentation

This directory contains the documentation for the MCP Proxy Wrapper project. The documentation is built using GitHub Pages with Jekyll and includes both manually written guides and automatically generated API reference documentation.

## Documentation Structure

- **Home**: Overview of the MCP Proxy Wrapper project
- **Getting Started**: Guide to help you start using the library
- **API Reference**: Detailed documentation of the library's API
- **Examples**: Code examples showing how to use the library in different scenarios

## Local Development

To run the documentation site locally:

1. Install Jekyll and its dependencies:
   ```bash
   gem install jekyll bundler
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Generate the API reference documentation:
   ```bash
   npm run docs
   ```

4. Serve the documentation site locally:
   ```bash
   npm run docs:serve
   ```

5. Open your browser and navigate to `http://localhost:4000`

## Updating Documentation

### Manual Documentation

The manually written documentation is in Markdown format and can be found in the following files:

- `index.md`: Home page
- `getting-started.md`: Getting Started guide
- `api.md`: API overview
- `examples.md`: Usage examples

### API Reference

The API reference documentation is automatically generated from the TypeScript source code using TypeDoc. To update it:

1. Make sure your code is properly documented with JSDoc comments
2. Run `npm run docs` to regenerate the API reference

### Styling

The documentation site uses a custom stylesheet located at `assets/css/style.scss` that extends the default Jekyll theme.

## Publishing

The documentation is automatically built and published to GitHub Pages when changes are pushed to the main branch, using the GitHub workflow defined in `.github/workflows/github-pages.yml`.

## Contributing

If you'd like to contribute to the documentation:

1. Fork the repository
2. Make your changes
3. Submit a pull request

Please ensure that your documentation is clear, concise, and follows the existing style.
