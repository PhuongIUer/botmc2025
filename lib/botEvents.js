const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

function setupBotEvents(bot, config) {
  let hasCompletedFirstTask = false;
  let spawnCount = 0;

  bot.on('spawn', async () => {
    spawnCount++;
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`);
    
    if (spawnCount >= 2 && hasCompletedFirstTask) {
      bot.manager.completedBots++;
      console.log(`[${bot.username}] ✅ Đã hoàn thành nhiệm vụ (${bot.manager.completedBots}/${bot.manager.totalBots})`);
      bot.manager.checkAllBotsCompleted();
      return;
    }

    if (spawnCount === 1 && !hasCompletedFirstTask) {
      doFirstTask(bot, config);
    }
  });

  async function doFirstTask(bot, config) {
    console.log(`[${bot.username}] Bắt đầu task đầu tiên...`);

    setTimeout(() => {
      bot.chat(`/login ${bot.botConfig.password}`);
      console.log(`[${bot.username}] Đã login`);
    }, config.settings.firstTaskDelay);

    setTimeout(async () => {
      try {
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        const goal = new goals.GoalBlock(
          config.coordinates.goal.x,
          config.coordinates.goal.y,
          config.coordinates.goal.z
        );
        bot.pathfinder.setGoal(goal);

        bot.once('goal_reached', async () => {
          console.log(`[${bot.username}] Đã tới vị trí mục tiêu`);
          
          bot.setQuickBarSlot(config.inventory.hotbarSlot);
          console.log(`[${bot.username}] Đã cầm đồ ở ô thứ ${config.inventory.hotbarSlot + 1}`);
          
          setTimeout(() => {
            bot.activateItem();
            console.log(`[${bot.username}] Đã chuột phải`);

            setTimeout(() => {
              if (bot.currentWindow) {
                bot.clickWindow(config.inventory.clickSlots[0], 0, 0);
                console.log(`[${bot.username}] Đã click ô đầu tiên`);
                
                setTimeout(() => {
                  bot.clickWindow(config.inventory.clickSlots[1], 0, 0);
                  console.log(`[${bot.username}] Đã click ô thứ hai`);
                  
                  hasCompletedFirstTask = true;
                  console.log(`[${bot.username}] ✅ Đã hoàn thành task đầu tiên`);
                }, config.settings.firstTaskDelay);
              } else {
                console.log(`[${bot.username}] Không mở được hub`);
                setTimeout(() => doFirstTask(bot, config), config.settings.retryDelay);
              }
            }, config.settings.firstTaskDelay);
          }, config.settings.firstTaskDelay);
        });

        bot.once('path_update', (result) => {
          if (result.status === 'noPath') {
            console.log(`[${bot.username}] Không thể tìm đường đến vị trí`);
            setTimeout(() => doFirstTask(bot, config), config.settings.retryDelay);
          }
        });

        setTimeout(() => {
          if (!hasCompletedFirstTask) {
            console.log(`[${bot.username}] Timeout di chuyển, thử lại`);
            bot.pathfinder.stop();
            setTimeout(() => doFirstTask(bot, config), config.settings.retryDelay);
          }
        }, config.settings.movementTimeout);
      } catch (error) {
        console.log(`[${bot.username}] Lỗi trong task: ${error.message}`);
        setTimeout(() => doFirstTask(bot, config), config.settings.retryDelay);
      }
    }, config.settings.firstTaskDelay);
  }

  bot.on('kicked', reason => {
    console.log(`[${bot.username}] Bị kick:`, reason);
    if (!bot.isQuit) {
      bot.manager.resetAllBots();
    }
  });
  
  bot.on('error', err => {
    console.log(`[${bot.username}] Lỗi:`, err.message);
    if (!bot.isQuit) {
      bot.manager.resetAllBots();
    }
  });

  bot.on('end', () => {
    if (!bot.isQuit) {
      console.log(`[${bot.username}] Đã ngắt kết nối (bất thường)`);
      bot.manager.resetAllBots();
    }
  });
}

module.exports = {
  setupBotEvents
};