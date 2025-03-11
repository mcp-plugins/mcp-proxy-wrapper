/**
 * @file Calculator prompts
 * @version 1.0.0
 * 
 * Prompt templates for calculator operations
 */

export const basicCalculationPrompt = {
  name: "basic_calculation",
  description: "A guide for performing basic calculations",
  template: `
# Basic Calculator Guide

You can use the calculator to perform basic arithmetic operations. Here's how:

## Addition
To add two numbers, use the add tool:
{{#tool add}}
  a: 5
  b: 3
{{/tool}}

## Subtraction  
To subtract one number from another, use the subtract tool:
{{#tool subtract}}
  a: 10
  b: 4
{{/tool}}

## Multiplication
To multiply two numbers, use the multiply tool:
{{#tool multiply}}
  a: 6
  b: 7
{{/tool}}

## Division
To divide one number by another, use the divide tool:
{{#tool divide}}
  a: 20
  b: 5
{{/tool}}
`
};

export const complexCalculationPrompt = {
  name: "complex_calculation",
  description: "A guide for performing complex calculations",
  template: `
# Complex Calculator Guide

You can use the calculator to perform more advanced operations. Here's how:

## Powers and Exponents
To calculate one number raised to the power of another:
{{#tool power}}
  base: 2
  exponent: 3
{{/tool}}

## Square Roots
To find the square root of a number:
{{#tool sqrt}}
  number: 16
{{/tool}}

## Modulo Operations
To find the remainder when dividing one number by another:
{{#tool modulo}}
  a: 10
  b: 3
{{/tool}}

## Memory Operations
Store a value in memory:
{{#tool memory_store}}
  value: 42
{{/tool}}

Recall the value from memory:
{{#tool memory_recall}}{{/tool}}

Clear the memory:
{{#tool memory_clear}}{{/tool}}
`
};

export const multistepCalculationPrompt = {
  name: "multistep_calculation",
  description: "A guide for performing multi-step calculations",
  template: `
# Multi-step Calculation Guide

This guide shows how to perform calculations with multiple steps.

## Example: Calculate the area of a circle

1. First, let's square the radius (5):
{{#tool multiply}}
  a: 5
  b: 5
{{/tool}}

2. Now, let's multiply by π (approximately 3.14159):
{{#tool multiply}}
  a: 25
  b: 3.14159
{{/tool}}

The area of a circle with radius 5 is approximately 78.54 square units.

## Example: Calculate compound interest

For a principal of $1000 with 5% annual interest for 3 years:

1. Calculate the interest multiplier (1 + rate):
{{#tool add}}
  a: 1
  b: 0.05
{{/tool}}

2. Raise it to the power of the time period:
{{#tool power}}
  base: 1.05
  exponent: 3
{{/tool}}

3. Multiply by the principal:
{{#tool multiply}}
  a: 1000
  b: 1.157625
{{/tool}}

The final amount after 3 years is $1,157.63.
`
}; 