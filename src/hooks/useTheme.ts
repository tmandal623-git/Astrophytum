// src/hooks/useTheme.ts
// Convenience hook — re-exports from ThemeContext so components
// can import from a single hooks/ location if preferred.
//
// Usage:
//   import { useTheme } from '../hooks/useTheme';
//   const { theme, toggleTheme } = useTheme();

export { useTheme } from '../context/ThemeContext';
