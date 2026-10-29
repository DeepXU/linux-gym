// PM2 Production Ecosystem Configuration for Linux CTF Academy
// Runs on Dedicated Port 2000 (Ports 2000-2009 Range)
module.exports = {
  apps: [
    {
      name: 'linux-ctf-academy',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      env: {
        PORT: 2000,
        NODE_ENV: 'production',
        LLM_PROVIDER: 'ollama',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OLLAMA_MODEL: 'qwen2.5-coder:7b',
        LLAMA_GUARD_MODEL: 'llama-guard3:1b',
        VLLM_BASE_URL: 'http://localhost:2005/v1'
      }
    }
  ]
};
