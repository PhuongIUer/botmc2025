const config = require('./config.json');
const BotManager = require('./lib/botManager');

// ========== TẮT CẢNH BÁO PARTIAL PACKET ==========
process.setMaxListeners(50);
process.on('warning', (warning) => {
  if (warning.message.includes('partial packet')) return;
});

// Khởi tạo bot manager
const botManager = new BotManager(config);

// Bắt đầu các bot
botManager.startBots();

// Xử lý tắt script
process.on('SIGINT', () => {
  botManager.shutdown();
});