import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * @file Documentation resource
 * @version 1.0.0
 * 
 * Resource for accessing calculator documentation
 */

// Template for getting calculator documentation
export const documentationTemplate = new ResourceTemplate(
  "calculator://documentation/{section}", 
  { list: undefined }
);

// Documentation sections
export const documentation = {
  basic: `
# Basic Operations

The calculator supports these basic operations:

- **add(a, b)**: Adds two numbers
  Example: add(5, 3) = 8
  
- **subtract(a, b)**: Subtracts b from a
  Example: subtract(10, 4) = 6
  
- **multiply(a, b)**: Multiplies two numbers
  Example: multiply(6, 7) = 42
  
- **divide(a, b)**: Divides a by b
  Example: divide(20, 5) = 4
  Note: Cannot divide by zero
`,

  advanced: `
# Advanced Operations

The calculator supports these advanced operations:

- **power(base, exponent)**: Raises base to the power of exponent
  Example: power(2, 3) = 8
  
- **sqrt(number)**: Calculates the square root of a number
  Example: sqrt(16) = 4
  Note: Cannot calculate for negative numbers
  
- **modulo(a, b)**: Calculates the remainder when a is divided by b
  Example: modulo(10, 3) = 1
  Note: Cannot use zero as divisor
`,

  memory: `
# Memory Operations

The calculator has memory functions:

- **memory_store(value)**: Stores a value in memory
  Example: memory_store(42)
  
- **memory_recall()**: Recalls the value from memory
  Example: memory_recall() = 42
  
- **memory_clear()**: Clears the memory
  Example: memory_clear()
`,

  all: `
# Calculator Documentation

## Basic Operations
- add(a, b): Adds two numbers
- subtract(a, b): Subtracts b from a
- multiply(a, b): Multiplies two numbers
- divide(a, b): Divides a by b

## Advanced Operations
- power(base, exponent): Raises base to the power of exponent
- sqrt(number): Calculates the square root of a number
- modulo(a, b): Calculates the remainder when a is divided by b

## Memory Operations
- memory_store(value): Stores a value in memory
- memory_recall(): Recalls the value from memory
- memory_clear(): Clears the memory

## Resources
- calculator://documentation/{section}: Access documentation
- calculator://history/all: View all calculation history
- calculator://history/recent/{count}: View recent calculations
- calculator://history/operation/{operation}: View calculations by operation type
- calculator://memory: View current memory state

## Prompts
- calculator://prompts/basic: Basic calculation guide
- calculator://prompts/complex: Complex calculation guide
`
};

/**
 * Handler for documentation resource
 */
export async function handleDocumentation(uri: URL, variables: { section: string }) {
  const { section } = variables;
  const docText = documentation[section as keyof typeof documentation] || 
    "Documentation section not found. Available sections: basic, advanced, memory, all";
  
  return {
    contents: [{
      uri: uri.href,
      text: docText
    }]
  };
} 