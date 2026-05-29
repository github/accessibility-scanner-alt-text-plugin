import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {ignores: ['node_modules', 'dist', 'coverage', '.vitest']},
  ...tseslint.configs.recommended,
  prettier,
)
