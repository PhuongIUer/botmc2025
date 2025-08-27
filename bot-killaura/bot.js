const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const config = require('./config.json')

// ========== TẮT CẢNH BÁO PARTIAL PACKET ==========
process.setMaxListeners(50)
process.on('warning', (warning) => {
  if (warning.message.includes('partial packet')) return
})

let bots = []
let completedBots = 0
let allBotsCompleted = false
let globalIntervalId = null
let resetIntervalId = null

// ========== HÀM XÓA TERMINAL CHO TERMUX ==========
function clearTerminal() {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

// ========== HÀM RESET TẤT CẢ BOT ==========
async function resetAllBots() {
  console.log('🔄 Bắt đầu reset tất cả bot...')
  
  // Dọn dẹp interval toàn cục nếu có
  if (globalIntervalId) {
    clearInterval(globalIntervalId)
    globalIntervalId = null
  }
  
  // Ngắt kết nối tất cả bot
  for (const bot of bots) {
    try {
      if (bot && typeof bot.quit === 'function') {
        bot.quit()
        console.log(`[${bot.username}] Đã ngắt kết nối`)
      }
    } catch (err) {
      console.log(`Lỗi khi ngắt kết nối bot: ${err.message}`)
    }
  }
  
  // Reset biến toàn cục
  bots = []
  completedBots = 0
  allBotsCompleted = false
  
  // Đợi một chút để đảm bảo tất cả bot đã ngắt kết nối
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Khởi động lại tất cả bot
  console.log('🔄 Khởi động lại tất cả bot...')
  config.botConfigs.forEach((botConfig, index) => {
    createBotWithDelay(botConfig, index * config.intervals.botStartDelay, index)
  })
}

// ========== HÀM TẠO BOT ==========
function createBotWithDelay(botConfig, delay, index) {
  setTimeout(() => {
    console.log(`🚀 Khởi động bot: ${botConfig.username}`)
    
    const botOptions = {
      host: config.server.host,
      port: config.server.port,
      username: botConfig.username,
      version: config.server.version,
      keepAlive: true,         
      checkTimeoutInterval: 120 * 1000  
    }

    const bot = mineflayer.createBot(botOptions)
    bot.loadPlugin(pathfinder)
    bot.botConfig = botConfig

    // Tắt cảnh báo partial packet
    bot._client.on('error', (err) => {
      if (err.message.includes('partial packet')) return
    })

    setupBotEvents(bot)
    bots.push(bot)
  }, delay)
}

function startHotbarLogger(bot) {
  console.log(`[${bot.username}] 📦 Bắt đầu log thông tin hotbar mỗi ${config.intervals.hotbarLog/1000} giây`)

  const logHotbarItems = () => {
    // Hotbar: slots 36 đến 44
    const hotbarSlots = Array.from({ length: 45 }, (_, i) => i )
    const items = hotbarSlots.map(slot => {
      const item = bot.inventory.slots[slot]
      return item ? `${item.name} (x${item.count})` : 'Trống'
    })
    
    console.log(`[${bot.username}] 🎒 HOTBAR: ${items.join(' | ')}`)
  }

  // Thiết lập interval
  return setInterval(logHotbarItems, config.intervals.hotbarLog)
}

// ========== HÀM TỰ ĐỘNG ĂN STEAK ==========
async function autoEatSteak(bot) {
  try {
    // Nếu food <= threshold thì ăn
    if (bot.food <= config.settings.foodThreshold) {
      console.log(`[${bot.username}] 🍗 Đang đói (${bot.food}/20), tìm steak...`)

      // Slot cuối cùng của inventory = 44
      const steak = bot.inventory.slots[44]

      if (!steak || steak.name !== 'cooked_beef') {
        console.log(`[${bot.username}] ❌ Không có steak ở slot cuối`)
        return
      }

      // Equip steak lên tay
      await bot.equip(steak, 'hand')

      // Ăn
      await bot.consume()
      console.log(`[${bot.username}] ✅ Đã ăn steak`)

      // Chỉnh lại về hotbar slot 1 (index = 0)
      bot.setQuickBarSlot(0)
      console.log(`[${bot.username}] 🔄 Đã đổi lại về hotbar slot 1`)
    }
  } catch (err) {
    console.log(`[${bot.username}] ⚠️ Lỗi khi auto ăn:`, err)
  }
}

// ========== TÌM ENTITY GẦN NHẤT NGOẠI TRỪ PLAYER ==========
function findNearestEntityExceptPlayer(bot) {
  const entityFilter = e => e.type !== 'player' && e.displayName !== 'Text Display'&& e.displayName !== 'Item' && 
                          e.position.distanceTo(bot.entity.position) < config.settings.attackRange
  
  const entity = bot.nearestEntity(entityFilter)
  return entity
}

// ========== TẤN CÔNG ENTITY NGẪU NHIÊN ==========
function startRandomAttacking(bot) {
  console.log(`[${bot.username}] 🗡️ Bắt đầu chế độ tấn công "giống người"`)

  let attackInterval = null
  let resetAttackInterval = null
  let attackCount = 0

  const attack = async () => {
    const entity = findNearestEntityExceptPlayer(bot)
    if (!entity) return

    // Nhìn vào entity
    await bot.lookAt(entity.position.offset(0, 1, 0))
    const distance = entity.position.distanceTo(bot.entity.position)
    console.log(
      `[${bot.username}] 📍 ${entity.displayName} - Khoảng cách: ${distance.toFixed(1)}m - Vị trí: X:${Math.round(entity.position.x)} Y:${Math.round(entity.position.y)} Z:${Math.round(entity.position.z)}`
    )
    if (entity.displayName === 'Armor Stand') {
      resetAllBots()
      return
    }

    const cycle = attackCount % 100

    if (cycle < config.settings.criticalHitCycles) {
      // Critical hits
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 100)

      setTimeout(() => {
        if (bot.entity.onGround) return
        bot.attack(entity)
        attackCount++
        console.log(`[${bot.username}] 💥 Critical hit vào ${entity.displayName} (lần ${attackCount})`)
      }, 400)

    } else {
      // Normal hits
      bot.attack(entity)
      attackCount++
      console.log(`[${bot.username}] 🗡️ Normal hit vào ${entity.displayName} (lần ${attackCount})`)
    }
  }

  const startAttackInterval = () => {
    const delay = config.intervals.attackDelayMin + Math.random() * (config.intervals.attackDelayMax - config.intervals.attackDelayMin)
    attackInterval = setInterval(attack, delay)
    console.log(`[${bot.username}] ⏰ Tấn công mỗi ~${delay.toFixed(0)}ms`)
  }

  startAttackInterval()

  // Reset interval để delay thay đổi
  resetAttackInterval = setInterval(() => {
    if (attackInterval) {
      clearInterval(attackInterval)
      startAttackInterval()
    }
  }, config.intervals.attackPatternReset)

  // Hàm dừng
  return () => {
    if (attackInterval) {
      clearInterval(attackInterval)
      attackInterval = null
    }
    if (resetAttackInterval) {
      clearInterval(resetAttackInterval)
      resetAttackInterval = null
    }
    console.log(`[${bot.username}] 🛑 Dừng tấn công - Tổng số lần tấn công: ${attackCount}`)
  }
}

// ========== KIỂM TRA TẤT CẢ BOT ĐÃ HOÀN THÀNH ==========
function checkAllBotsCompleted() {
  if (completedBots === config.botConfigs.length && !allBotsCompleted) {
    allBotsCompleted = true
    
    // Đợi 3 giây trước khi clear terminal
    setTimeout(() => {
      // Xóa terminal trong Termux
      clearTerminal()
      console.log('✅ TẤT CẢ BOT ĐÃ HOÀN THÀNH NHIỆM VỤ')
      console.log('⏰ Bắt đầu log mỗi 10 phút...\n')
      
      // Log ngay lần đầu tiên
      const now = new Date()
      const timeString = now.toLocaleTimeString('vi-VN')
      console.log(`📢 Bây giờ là : ${timeString}`)
      
      // Thiết lập interval log toàn cục
      let count = 2
      globalIntervalId = setInterval(() => {
        const now = new Date()
        const timeString = now.toLocaleTimeString('vi-VN')
        console.log(`📢 10p lần ${count} : ${timeString}`)
        count++
      }, config.intervals.globalLog)
    }, 3000) // Đợi 3 giây
  }
}

// ========== THIẾT LẬP SỰ KIỆN BOT ==========
function setupBotEvents(bot) {
  let hasCompletedFirstTask = false
  let spawnCount = 0
  bot.stopAttacking = null

  bot.on('spawn', async () => {
    spawnCount++
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`)
    
    if (spawnCount === 2 && hasCompletedFirstTask) {
      completedBots++
      console.log(`[${bot.username}] ✅ Đã hoàn thành nhiệm vụ (${completedBots}/${config.botConfigs.length})`)
      
      // Bắt đầu log hotbar
      bot.hotbarInterval = startHotbarLogger(bot)
      
      // Bắt đầu kiểm tra đói
      bot.hungerInterval = setInterval(() => autoEatSteak(bot), config.intervals.autoEatCheck)
      console.log(`[${bot.username}] 🍗 Đã bật auto eat (kiểm tra mỗi ${config.intervals.autoEatCheck/1000}s)`)

      bot.setQuickBarSlot(0)
      console.log(`[${bot.username}] Đã cầm đồ ở ô thứ 1`)
      
      // Nếu là bot đặc biệt, bắt đầu tấn công entity
      if (bot.botConfig.special && !bot.stopAttacking) {
        bot.stopAttacking = startRandomAttacking(bot)
      }
      
      checkAllBotsCompleted()
      return
    }

    // Spawn lần 1: làm task đầu tiên
    if (spawnCount === 1 && !hasCompletedFirstTask) {
      doFirstTask(bot)
    }
  })

  // ========== TASK ĐẦU TIÊN ==========
  async function doFirstTask(bot) {
    console.log(`[${bot.username}] Bắt đầu task đầu tiên...`)

    setTimeout(() => {
      bot.chat(`/login ${bot.botConfig.password}`)
      console.log(`[${bot.username}] Đã login`)
    }, 2000)

    setTimeout(async () => {
      const mcData = require('minecraft-data')(bot.version)
      const movements = new Movements(bot, mcData)
      bot.pathfinder.setMovements(movements)

      const goal = new goals.GoalBlock(
        config.positions.target.x,
        config.positions.target.y,
        config.positions.target.z
      )
      bot.pathfinder.setGoal(goal)

      bot.once('goal_reached', async () => {
        console.log(`[${bot.username}] Đã tới vị trí (${config.positions.target.x}, ${config.positions.target.y}, ${config.positions.target.z})`)
        
        bot.setQuickBarSlot(4)
        console.log(`[${bot.username}] Đã cầm đồ ở ô thứ 5`)
        setTimeout(() => {
          bot.activateItem()
          console.log(`[${bot.username}] Đã chuột phải`)

          setTimeout(() => {
            if (bot.currentWindow) {
              // Click vào các ô GUI được định nghĩa trong config
              config.positions.guiClicks.forEach((click, index) => {
                setTimeout(() => {
                  bot.clickWindow(click.slot, 0, 0)
                  console.log(`[${bot.username}] Đã click ${click.description}`)
                  
                  if (index === config.positions.guiClicks.length - 1) {
                    hasCompletedFirstTask = true
                    console.log(`[${bot.username}] ✅ Đã hoàn thành task đầu tiên`)
                  }
                }, 2000 * (index + 1))
              })
            } else {
              console.log(`[${bot.username}]  Không mở được hub`)
            }
          }, 2000)
        }, 3000)
      })
    }, 3000)
  }

  bot.on('kicked', reason => {
    console.log(`[${bot.username}] Bị kick:`, reason)
    if (bot.stopAttacking) {
      bot.stopAttacking()
      bot.stopAttacking = null
    }
    if (bot.hotbarInterval) clearInterval(bot.hotbarInterval)
    if (bot.hungerInterval) clearInterval(bot.hungerInterval)
    if (bot.attackInterval) clearInterval(bot.attackInterval)
    resetAllBots()
  })

  bot.on('error', err => {
    console.log(`[${bot.username}] Lỗi:`, err)
    if (bot.stopAttacking) {
      bot.stopAttacking()
      bot.stopAttacking = null
    }
    if (bot.hotbarInterval) clearInterval(bot.hotbarInterval)
    if (bot.hungerInterval) clearInterval(bot.hungerInterval)
    if (bot.attackInterval) clearInterval(bot.attackInterval)
    resetAllBots()
  })

  bot.on('end', () => {
    console.log(`[${bot.username}] Đã ngắt kết nối`)
    if (bot.stopAttacking) {
      bot.stopAttacking()
      bot.stopAttacking = null
    }
    if (bot.hotbarInterval) clearInterval(bot.hotbarInterval)
    if (bot.hungerInterval) clearInterval(bot.hungerInterval)
    if (bot.attackInterval) clearInterval(bot.attackInterval)
  })

  bot.on('quit', () => {
    console.log(`[${bot.username}] Đã tự thoát`)
    if (bot.stopAttacking) {
      bot.stopAttacking()
      bot.stopAttacking = null
    }
    if (bot.hotbarInterval) clearInterval(bot.hotbarInterval)
    if (bot.hungerInterval) clearInterval(bot.hungerInterval)
    if (bot.attackInterval) clearInterval(bot.attackInterval)
  })
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${config.botConfigs.length} bot...`)
config.botConfigs.forEach((botConfig, index) => {
  createBotWithDelay(botConfig, index * config.intervals.botStartDelay, index)
})

// ========== THIẾT LẬP RESET ĐỊNH KỲ ==========
resetIntervalId = setInterval(() => {
  resetAllBots()
}, config.intervals.autoReset)

// ========== XỬ LÝ TẮT SCRIPT ==========
process.on('SIGINT', () => {
  console.log('\n🛑 Đang tắt tất cả bot...')
  
  // Dọn dẹp tất cả interval
  if (globalIntervalId) {
    clearInterval(globalIntervalId)
  }
  if (resetIntervalId) {
    clearInterval(resetIntervalId)
  }
  
  // Ngắt kết nối tất cả bot
  bots.forEach(bot => {
    if (bot && typeof bot.quit === 'function') {
      bot.quit()
    }
  })
  
  setTimeout(() => process.exit(), 1000)
})