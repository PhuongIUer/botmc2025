const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

function setupBotEvents(bot, config) {
  let hasCompletedFirstTask = false;
  let spawnCount = 0;
  let taskCompletionTime = 0;
  let respawnCheckTimeout = null;

  bot.on('spawn', async () => {
    spawnCount++;
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`);

    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }

    // 🚨 Nếu spawn lại sau khi đã làm xong Task 2 → reset để làm lại từ Task 1
    if (spawnCount > 1) {
      hasCompletedFirstTask = false;  
      console.log(`[${bot.username}] Spawn lại → reset task về trạng thái ban đầu`);
      doFirstTask(bot, config); // gọi lại Task 1
      return;
    }

    // Spawn lần đầu
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
                  taskCompletionTime = Date.now();
                  console.log(`[${bot.username}] ✅ Đã hoàn thành task đầu tiên`);
                  
                  // Thiết lập kiểm tra respawn sau 5 giây
                  respawnCheckTimeout = setTimeout(() => {
                    if (spawnCount < 2) {
                      console.log(`[${bot.username}] ❌ Không spawn lại sau 5 giây, làm lại task 1`);
                      hasCompletedFirstTask = false;
                      doFirstTask(bot, config);
                    }
                  }, 5000); // 5 giây
                  
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
    // Hủy bỏ kiểm tra respawn nếu có
    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }
    if (!bot.isQuit) {
      bot.manager.resetAllBots();
    }
  });
  
  bot.on('error', err => {
    console.log(`[${bot.username}] Lỗi:`, err.message);
    // Hủy bỏ kiểm tra respawn nếu có
    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }
    if (!bot.isQuit) {
      bot.manager.resetAllBots();
    }
  });

  bot.on('end', () => {
    // Hủy bỏ kiểm tra respawn nếu có
    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }
    if (!bot.isQuit) {
      console.log(`[${bot.username}] Đã ngắt kết nối (bất thường)`);
      bot.manager.resetAllBots();
    }
  });
}

module.exports = {
  setupBotEvents
};