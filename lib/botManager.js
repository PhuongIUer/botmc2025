const mineflayer = require('mineflayer');
const { clearTerminal, formatTime } = require('./utils');

class BotManager {
  constructor(config) {
    this.config = config;
    this.bots = [];
    this.completedBots = 0;
    this.allBotsCompleted = false;
    this.globalIntervalId = null;
    this.resetIntervalId = null;
    this.isResetting = false;
    this.totalBots = config.bots.length;
  }

  createBotWithDelay(config, delay, index) {
    setTimeout(() => {
      console.log(`🚀 Khởi động bot: ${config.username}`);
      
      const botOptions = {
        host: this.config.server.host,
        port: this.config.server.port,
        username: config.username,
        version: this.config.server.version,
        keepAlive: true,
        checkTimeoutInterval: 120 * 1000
      };

      const bot = mineflayer.createBot(botOptions);
      bot.loadPlugin(require('mineflayer-pathfinder').pathfinder);
      bot.botConfig = config;
      bot.username = config.username;
      bot.manager = this;

      // Tắt cảnh báo partial packet
      bot._client.on('error', (err) => {
        if (err.message.includes('partial packet')) return;
      });

      require('./botEvents').setupBotEvents(bot, this.config);
      this.bots.push(bot);
    }, delay);
  }

  async resetAllBots() {
    if (this.isResetting) {
      console.log('⚠️ Đang trong quá trình reset, bỏ qua yêu cầu mới');
      return;
    }
    
    this.isResetting = true;
    console.log('🔄 Bắt đầu reset tất cả bot...');
    
    if (this.globalIntervalId) {
      clearInterval(this.globalIntervalId);
      this.globalIntervalId = null;
    }
    
    const disconnectPromises = [];
    for (const bot of this.bots) {
      if (bot && typeof bot.quit === 'function') {
        disconnectPromises.push(new Promise(resolve => {
          try {
            bot.isQuit = true;
            bot.quit();
            console.log(`[${bot.username}] Đã ngắt kết nối (do script)`);
          } catch (err) {
            console.log(`Lỗi khi ngắt kết nối bot: ${err.message}`);
          }
          resolve();
        }));
      }
    }
    
    await Promise.all(disconnectPromises);
    
    this.bots = [];
    this.completedBots = 0;
    this.allBotsCompleted = false;
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('🔄 Khởi động lại tất cả bot...');
    this.config.bots.forEach((config, index) => {
      this.createBotWithDelay(config, index * this.config.settings.botStartDelay, index);
    });
    
    this.isResetting = false;
  }

  checkAllBotsCompleted() {
    if (this.completedBots === this.totalBots && !this.allBotsCompleted) {
      this.allBotsCompleted = true;
      
      setTimeout(() => {
        clearTerminal();
        console.log('✅ TẤT CẢ BOT ĐÃ HOÀN THÀNH NHIỆM VỤ');
        console.log('⏰ Bắt đầu log mỗi 10 phút...\n');
  


        const now = new Date();
        const timeString = formatTime(now);
        console.log(`📢 Bây giờ là : ${timeString}`);
        
        let count = 1;
        this.globalIntervalId = setInterval(() => {
          const now = new Date();
          const timeString = formatTime(now);
          console.log(`📢 10p lần ${count} : ${timeString}`);
          count++;
          this.bots.forEach(bot => {
            if (bot) {
              bot.chat(`/pay ShiKuu 1000000`);
              console.log(`💰 ${bot.username} đã chuyển $1M`);
            }
          })
        }, this.config.settings.logInterval);
      }, 3000);
    }
  }

  startBots() {
    console.log(`🟢 Bắt đầu khởi chạy ${this.totalBots} bot...`);
    this.config.bots.forEach((config, index) => {
      this.createBotWithDelay(config, index * this.config.settings.botStartDelay, index);
    });
  }

  shutdown() {
    console.log('\n🛑 Đang tắt tất cả bot...');
    
    if (this.globalIntervalId) {
      clearInterval(this.globalIntervalId);
    }
    if (this.resetIntervalId) {
      clearInterval(this.resetIntervalId);
    }
    
    this.bots.forEach(bot => {
      if (bot && typeof bot.quit === 'function') {
        console.log(`🛑 ${bot.username} đã thoát`);
        bot.isQuit = true;
        bot.quit();
      }
    });
    
    setTimeout(() => process.exit(), 1000);
  }
}

module.exports = BotManager;