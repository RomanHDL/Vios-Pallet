// PM2 para Coolify: `pnpm start` = `pm2-runtime ecosystem.config.cjs` (proceso en primer plano,
// logs a stdout/stderr como espera el contenedor). CommonJS porque PM2 carga este archivo con require().
module.exports = {
  apps: [
    {
      name: 'vios-pallet',
      script: 'server/index.js',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production' },
    },
  ],
}
