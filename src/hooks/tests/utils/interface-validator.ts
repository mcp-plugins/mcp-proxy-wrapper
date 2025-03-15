/**
 * @file Interface Validation Utilities
 * @version 1.0.0
 * 
 * Utilities for validating interface implementations in tests
 */

/**
 * Validates that an object implements the required methods of an interface
 * @param obj The object to validate
 * @param methodNames Array of method names that should be implemented
 * @returns Object with validation results
 */
export function validateInterfaceImplementation(obj: any, methodNames: string[]): {
  implementsAll: boolean;
  missingMethods: string[];
} {
  const missingMethods: string[] = [];
  
  for (const methodName of methodNames) {
    if (typeof obj[methodName] !== 'function') {
      missingMethods.push(methodName);
    }
  }
  
  return {
    implementsAll: missingMethods.length === 0,
    missingMethods
  };
}

/**
 * Checks if an object has all required properties
 * @param obj The object to validate
 * @param propNames Array of property names that should exist
 * @returns Object with validation results
 */
export function validateRequiredProperties(obj: any, propNames: string[]): {
  hasAllProps: boolean;
  missingProps: string[];
} {
  const missingProps: string[] = [];
  
  for (const propName of propNames) {
    if (!(propName in obj)) {
      missingProps.push(propName);
    }
  }
  
  return {
    hasAllProps: missingProps.length === 0,
    missingProps
  };
}
