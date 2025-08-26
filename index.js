const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

// ========== TẮT CẢNH BÁO PARTIAL PACKET ==========
process.setMaxListeners(50)
process.on('warning', (warning) => {
  if (warning.message.includes('partial packet')) return
})

// ========== DANH SÁCH BOT ==========
const botConfigs = [
  { username: 'nobody05', password: '11092003' },
  { username: 'nobody06', password: '11092003' },
  { username: 'nobody07', password: '11092003' },
  { username: 'nobody08', password: '11092003' },
  { username: 'nobody09', password: '11092003' },
]

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
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  // Khởi động lại tất cả bot
  console.log('🔄 Khởi động lại tất cả bot...')
  botConfigs.forEach((config, index) => {
    createBotWithDelay(config, index * 30000, index)
  })
}

// ========== HÀM TẠO BOT ==========
function createBotWithDelay(config, delay, index) {
  setTimeout(() => {
    console.log(`🚀 Khởi động bot: ${config.username}`)
    
    const botOptions = {
      host: 'luckyvn.com',
      port: 25565,
      username: config.username,
      version: '1.21.4',
      keepAlive: true,         
      checkTimeoutInterval: 120 * 1000  
    }

    const bot = mineflayer.createBot(botOptions)
    bot.loadPlugin(pathfinder)
    bot.botConfig = config

    // Tắt cảnh báo partial packet
    bot._client.on('error', (err) => {
      if (err.message.includes('partial packet')) return
    })

    setupBotEvents(bot)
    bots.push(bot)
  }, delay)
}

// ========== KIỂM TRA TẤT CẢ BOT ĐÃ HOÀN THÀNH ==========
function checkAllBotsCompleted() {
  if (completedBots === botConfigs.length && !allBotsCompleted) {
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
      let count = 1
      globalIntervalId = setInterval(() => {
        const now = new Date()
        const timeString = now.toLocaleTimeString('vi-VN')
        console.log(`📢 10p lần ${count} : ${timeString}`)
        count++
      }, 10 * 60 * 1000) // 10 phút
    }, 3000) // Đợi 3 giây
  }
}

// ========== THIẾT LẬP SỰ KIỆN BOT ==========
function setupBotEvents(bot) {
  let hasCompletedFirstTask = false
  let spawnCount = 0

  bot.on('spawn', async () => {
    spawnCount++
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`)
    
    // Nếu đã hoàn thành task đầu tiên (spawn lần 2)
    if (spawnCount >= 2 && hasCompletedFirstTask) {
      completedBots++
      console.log(`[${bot.username}] ✅ Đã hoàn thành nhiệm vụ (${completedBots}/${botConfigs.length})`)
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

      const goal = new goals.GoalBlock(-2, 65, -3)
      bot.pathfinder.setGoal(goal)

      bot.once('goal_reached', async () => {
        console.log(`[${bot.username}] Đã tới vị trí (-2, 65, -3)`)
        
        bot.setQuickBarSlot(4)
        console.log(`[${bot.username}] Đã cầm đồ ở ô thứ 5`)
        setTimeout(() => {
          bot.activateItem()
          console.log(`[${bot.username}] Đã chuột phải`)

          setTimeout(() => {
            if (bot.currentWindow) {
              bot.clickWindow(22, 0, 0)
              console.log(`[${bot.username}] Đã click ô cột 5 hàng 3`)
              
              setTimeout(() => {
                bot.clickWindow(30, 0, 0)
                console.log(`[${bot.username}] Đã click ô cột 4 hàng 4`)
                
                hasCompletedFirstTask = true
                console.log(`[${bot.username}] ✅ Đã hoàn thành task đầu tiên`)
                               
              }, 2000)
            } else 
              console.log(`[${bot.username}]  Không mở được hub`)
          }, 2000)
        }, 3000)
      })
    }, 3000)
  }

  bot.on('kicked', reason => {
    console.log(`[${bot.username}] Bị kick:`, reason)
    resetAllBots()
})
  bot.on('error', err => {
  console.log(`[${bot.username}] Lỗi:`, err) 
  resetAllBots()
})
  bot.on('end', () => console.log(`[${bot.username}] Đã ngắt kết nối`))
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${botConfigs.length} bot...`)
botConfigs.forEach((config, index) => {
  createBotWithDelay(config, index * 30000, index)
})

// ========== THIẾT LẬP RESET ĐỊNH KỲ 40 PHÚT ==========
resetIntervalId = setInterval(() => {
  resetAllBots()
}, 41 * 60 * 1000) // 40 phút

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