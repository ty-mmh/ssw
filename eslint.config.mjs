// eslint.config.mjs
import { defineConfig } from 'eslint';

export default defineConfig({
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',    // Reactの推奨設定
    'plugin:prettier/recommended', // Prettier統合設定
  ],
  plugins: ['react', 'prettier'],  // Prettierをpluginとして追加
  rules: {
    'react/prop-types': 'off', // 必要に応じて無効化
    'no-console': 'warn',       // console.logを警告に
    'semi': ['error', 'always'], // セミコロンを必須
    'quotes': ['error', 'single'], // シングルクォートを必須
    'indent': ['error', 2], // インデントはスペース2つ
    'prettier/prettier': 'error', // Prettierのスタイルを強制
  },
});