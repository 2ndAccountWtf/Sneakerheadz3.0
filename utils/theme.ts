
import { StoreTheme } from '../types/theme';

function toKebabCase(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

export function generateThemeCssVariables(theme: StoreTheme): string {
    let cssString = '';
    
    // Process colors
    for (const [key, value] of Object.entries(theme.colors)) {
        if(value) cssString += `--color-${toKebabCase(key)}: ${value};\n`;
    }
    
    // Process typography
    cssString += `--font-display: ${theme.typography.displayFont};\n`;
    cssString += `--font-ui: ${theme.typography.uiFont};\n`;
    if(theme.typography.numeralFont) cssString += `--font-numeral: ${theme.typography.numeralFont};\n`;
    cssString += `--font-weight-display: ${theme.typography.displayWeight || 700};\n`;
    cssString += `--font-weight-ui: ${theme.typography.uiWeight || 600};\n`;
    cssString += `--text-transform-headings: ${theme.typography.capsHeadings ? 'uppercase' : 'none'};\n`;

    // Process shapes
    if(theme.shape) {
        if(theme.shape.cardRadius !== undefined) cssString += `--radius-card: ${theme.shape.cardRadius}px;\n`;
        if(theme.shape.buttonRadius !== undefined) cssString += `--radius-button: ${theme.shape.buttonRadius}px;\n`;
        if(theme.shape.chipRadius !== undefined) cssString += `--radius-chip: ${theme.shape.chipRadius}px;\n`;
        if(theme.shape.borderWeight !== undefined) cssString += `--border-weight: ${theme.shape.borderWeight}px;\n`;
    }

    return cssString;
}
