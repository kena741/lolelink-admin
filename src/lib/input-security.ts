/**
 * Input Security Utilities
 * Provides comprehensive input sanitization and validation to prevent XSS, SQL injection,
 * and other security vulnerabilities.
 */

// XSS patterns to detect and block
const XSS_PATTERNS: RegExp[] = [
  /<script\b/gi,
  /<\/script>/gi,
  /<iframe\b/gi,
  /<\/iframe>/gi,
  /<object\b/gi,
  /<embed\b/gi,
  /<link\b/gi,
  /<meta\b/gi,
  new RegExp('<' + 'img\\b[^>]*onerror\\s*=', 'gi'),
  /<svg\b[^>]*onload\s*=/gi,
  /javascript:/gi,
  /JAVASCRIPT:/g,
  /vbscript:/gi,
  /VBSCRIPT:/g,
  /data:text\/html/gi,
  /\bon\w+\s*=/gi, // Event handlers like onclick, onload, etc.
  /onclick\s*=/gi,
  /onload\s*=/gi,
  /onmouseover\s*=/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /&lt;script/gi,
  /&lt;\/script&gt;/gi,
  /&#x3C;script/gi,
  /&#60;script/gi,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /\bSELECT\s+.*\bFROM\b/gi,
  /\bINSERT\s+INTO\b/gi,
  /\bUPDATE\s+.*\bSET\b/gi,
  /\bDELETE\s+FROM\b/gi,
  /\bDROP\s+TABLE\b/gi,
  /\bCREATE\s+TABLE\b/gi,
  /\bALTER\s+TABLE\b/gi,
  /\bTRUNCATE\s+TABLE\b/gi,
  /\bUNION\s+(ALL\s+)?SELECT\b/gi,
  /\b(OR|AND)\s+\d+\s*=\s*\d+/gi,
  /\b(OR|AND)\s+['"]\w*['"]?\s*=\s*['"]\w*['"]?/gi,
  /(\-\-|\/\*|\*\/)/g, // SQL comments
  /\b(EXEC|EXECUTE|SP_|XP_)\b/gi,
  /CAST\s*\(|CONVERT\s*\(/gi,
  /WAITFOR\s+DELAY/gi,
  /BENCHMARK\s*\(/gi,
  /SLEEP\s*\(/gi,
];

// Template injection patterns
const TEMPLATE_INJECTION_PATTERNS = [
  /\{\{.*\}\}/g, // Handlebars/Mustache
  /\{%.*%\}/g, // Jinja2/Twig
  /\$\{.*\}/g, // Template literals
  /<\?.*\?>/g, // PHP tags
  /<%.*%>/g, // ASP/JSP tags
  /\{\{.*\|\s*safe\s*\}\}/g, // Template safe filters
];

// Malicious character patterns
const MALICIOUS_CHAR_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
  /[\uFEFF\uFFFE\uFFFF]/g, // Unicode BOM and invalid characters
  /[\u202A-\u202E]/g, // Unicode direction override
];

/**
 * Sanitizes input by removing HTML tags and escaping special characters
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // First remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Then escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove malicious characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/[\uFEFF\uFFFE\uFFFF]/g, '');
  sanitized = sanitized.replace(/[\u202A-\u202E]/g, '');
  
  return sanitized.trim();
}

/**
 * Validates secure text input - blocks XSS, SQL injection, and template injection
 */
function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) return true;
  }
  return false;
}

/**
 * Validates secure text input - blocks XSS, SQL injection, and template injection
 */
export function validateSecureTextInput(value: string): boolean {
  if (!value || typeof value !== 'string') return true;

  if (matchesAnyPattern(value, XSS_PATTERNS)) return false;
  if (matchesAnyPattern(value, SQL_INJECTION_PATTERNS)) return false;
  if (matchesAnyPattern(value, TEMPLATE_INJECTION_PATTERNS)) return false;

  return true;
}

/**
 * Validates secure name input - allows international characters but blocks malicious content
 */
export function validateSecureNameInput(value: string): boolean {
  if (!value || typeof value !== 'string') return true;
  
  // First check for general security threats
  if (!validateSecureTextInput(value)) {
    return false;
  }
  
  // Allow international characters, letters, spaces, hyphens, apostrophes
  const namePattern = /^[\p{L}\p{M}\s'\-\.]+$/u;
  
  // Check if it matches the name pattern
  if (!namePattern.test(value)) {
    return false;
  }
  
  // Additional checks for suspicious patterns in names
  const suspiciousNamePatterns = [
    /\b(admin|root|system|null|undefined)\b/gi,
    /\d{10,}/g, // Long sequences of numbers
    /(.)\1{10,}/g, // Repeated characters (more than 10)
    /[<>{}[\]]/g, // Brackets and braces
  ];
  
  for (const pattern of suspiciousNamePatterns) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates secure phone input - allows international phone formats but blocks malicious content
 */
export function validateSecurePhoneInput(value: string): boolean {
  if (!value || typeof value !== 'string') return true;
  
  // Remove common phone formatting characters for validation
  const cleanPhone = value.replace(/[\s\-\(\)\+\.]/g, '');
  
  // Check for basic security threats (but be lenient with phone-specific characters)
  const phoneSpecificXSSPatterns = [
    /<script/gi,
    /<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
  ];
  
  for (const pattern of phoneSpecificXSSPatterns) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  // Phone should contain mostly numbers and allowed formatting characters
  const phonePattern = /^[\+]?[\d\s\-\(\)\.]{7,20}$/;
  if (!phonePattern.test(value)) {
    return false;
  }
  
  // Ensure it has enough digits (at least 7)
  if (cleanPhone.length < 7 || cleanPhone.length > 15) {
    return false;
  }
  
  // Should contain only digits after cleaning
  if (!/^\d+$/.test(cleanPhone)) {
    return false;
  }
  
  return true;
}

/**
 * Validates secure email input
 */
export function validateSecureEmailInput(value: string): boolean {
  if (!value || typeof value !== 'string') return true;
  
  // Check for general security threats
  if (!validateSecureTextInput(value)) {
    return false;
  }
  
  // Basic email pattern validation
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(value)) {
    return false;
  }
  
  // Additional email-specific security checks
  const suspiciousEmailPatterns = [
    /\.\./g, // Double dots
    /^\./, // Starting with dot
    /\.$/, // Ending with dot (before @)
    /@.*@/g, // Multiple @ symbols
    /\s/g, // Spaces in email
  ];
  
  // Check for suspicious patterns
  if (suspiciousEmailPatterns[0].test(value) || // Double dots
      suspiciousEmailPatterns[1].test(value.split('@')[0]) || // Starting with dot
      suspiciousEmailPatterns[2].test(value.split('@')[0]) || // Ending with dot
      suspiciousEmailPatterns[3].test(value) || // Multiple @
      suspiciousEmailPatterns[4].test(value)) { // Spaces
    return false;
  }
  
  return true;
}

/**
 * Validates secure URL input
 */
export function validateSecureUrlInput(value: string): boolean {
  if (!value || typeof value !== 'string') return true;
  
  // Check for XSS in URLs
  const urlXSSPatterns = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /data:application\/x-httpd-php/gi,
    /<script/gi,
    /on\w+\s*=/gi,
  ];
  
  for (const pattern of urlXSSPatterns) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  // Only allow http, https, and mailto protocols
  const allowedProtocols = /^(https?:\/\/|mailto:)/i;
  if (value.includes(':') && !allowedProtocols.test(value)) {
    return false;
  }
  
  return true;
}

/**
 * Validates secure numeric input
 */
export function validateSecureNumericInput(value: string | number): boolean {
  if (value === null || value === undefined || value === '') return true;
  
  const stringValue = String(value);
  
  // Check for basic security threats
  if (!validateSecureTextInput(stringValue)) {
    return false;
  }
  
  // Should only contain digits, decimal point, minus sign, and plus sign
  const numericPattern = /^[+-]?(\d+\.?\d*|\.\d+)$/;
  if (!numericPattern.test(stringValue)) {
    return false;
  }
  
  return true;
}

/**
 * Creates security tests for yup validation
 */
export function createSecurityTests(validationFunction: (value: string) => boolean) {
  return {
    securityTest: function (value: unknown) {
      if (!value) return true;
      return validationFunction(String(value));
    },
    sanitizationTest: function (value: unknown) {
      if (!value) return true;
      const stringValue = String(value);
      const sanitized = sanitizeInput(stringValue);
      return sanitized === stringValue.trim();
    }
  };
}

/**
 * Security error messages
 */
export const SECURITY_ERROR_MESSAGES = {
  XSS_DETECTED: 'Input contains potentially harmful scripts or code',
  SQL_INJECTION_DETECTED: 'Input contains potentially harmful database commands',
  TEMPLATE_INJECTION_DETECTED: 'Input contains potentially harmful template code',
  MALICIOUS_CHARS_DETECTED: 'Input contains invalid or malicious characters',
  INVALID_NAME_FORMAT: 'Name contains invalid characters or format',
  INVALID_PHONE_FORMAT: 'Phone number format is invalid',
  INVALID_EMAIL_FORMAT: 'Email format is invalid',
  INVALID_URL_FORMAT: 'URL format is invalid or contains harmful content',
  INVALID_NUMERIC_FORMAT: 'Numeric value format is invalid',
} as const;
