import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const getVersionDate = () => {
  try {
    const gitDate = execSync('git log -1 --format=%cd --date=short').toString().trim();
    if (gitDate && /^\d{4}-\d{2}-\d{2}$/.test(gitDate)) {
      return gitDate;
    }
  } catch (e) {
    // ignore git errors
  }
  return new Date().toISOString().slice(0, 10);
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: './',
    define: {
      '__APP_VERSION__': JSON.stringify(getVersionDate())
    }
  };
});
