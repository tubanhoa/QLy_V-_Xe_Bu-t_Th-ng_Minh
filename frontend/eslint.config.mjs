import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'dist/**'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
]

export default eslintConfig
