function setupBotEvents(bot, config) {
  let spawnCount = 0;
  let respawnCheckTimeout = null;

  bot.on('spawn', async () => {
    spawnCount++;
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`);

    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }

    if (spawnCount === 1) {
      doTask1(bot, config); // lần spawn đầu → làm Task 1
    } else {
      doTask2(bot, config); // spawn lại → check task 2
    }
  });

  // ========== TASK 1 ==========
  async function doTask1(bot, config) {
    console.log(`[${bot.username}] Bắt đầu Task 1 (login + mở hub + click)`);

    setTimeout(() => {
      bot.chat(`/login ${bot.botConfig.password}`);
      console.log(`[${bot.username}] Đã login`);
    }, config.settings.firstTaskDelay);

    setTimeout(() => {
      try {
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

                console.log(`[${bot.username}] ✅ Hoàn thành Task 1`);

                // Chờ respawn để vào Task 2
                respawnCheckTimeout = setTimeout(() => {
                  console.log(`[${bot.username}] ❌ Không spawn lại, thử làm lại Task 1`);
                  doTask1(bot, config);
                }, 5000);

              }, config.settings.firstTaskDelay);
            } else {
              console.log(`[${bot.username}] Không mở được hub`);
              setTimeout(() => doTask1(bot, config), config.settings.retryDelay);
            }
          }, config.settings.firstTaskDelay);
        }, config.settings.firstTaskDelay);
      } catch (error) {
        console.log(`[${bot.username}] Lỗi trong Task 1: ${error.message}`);
        setTimeout(() => doTask1(bot, config), config.settings.retryDelay);
      }
    }, config.settings.firstTaskDelay);
  }

  // ========== TASK 2 ==========
  async function doTask2(bot, config) {
    console.log(`[${bot.username}] Bắt đầu Task 2 (kiểm tra dưới nước)`);

    setTimeout(() => {
      const blockBelow = bot.blockAt(bot.entity.position.offset(0, 0, 0));
      if (blockBelow && blockBelow.name.includes("water")) {
        console.log(`[${bot.username}] ✅ Đang đứng dưới nước → Hoàn thành Task 2`);
        bot.manager.completedBots++;
        bot.manager.checkAllBotsCompleted();
      } else {
        console.log(`[${bot.username}] ❌ Không dưới nước → Làm lại Task 1`);
        doTask1(bot, config);
      }
    }, 2000);
  }

  // ========== HANDLERS ==========
  bot.on('kicked', reason => {
    console.log(`[${bot.username}] Bị kick:`, reason);
    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }
    if (!bot.isQuit) bot.manager.resetAllBots();
  });

  bot.on('error', err => {
    console.log(`[${bot.username}] Lỗi:`, err.message);
    if (respawnCheckTimeout) {
      clearTimeout(respawnCheckTimeout);
      respawnCheckTimeout = null;
    }
    if (!bot.isQuit) bot.manager.resetAllBots();
  });

  bot.on('end', () => {
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
