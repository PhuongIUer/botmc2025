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
let isRestarting = false

// ========== HÀM XÓA TERMINAL CHO TERMUX ==========
function clearTerminal() {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

// ========== HÀM DỪNG TẤT CẢ BOT ==========
function stopAllBots() {
  console.log('🛑 Đang dừng tất cả bot...')
  
  // Dọn dẹp interval toàn cục
  if (globalIntervalId) {
    clearInterval(globalIntervalId)
    globalIntervalId = null
  }
  
  // Ngắt kết nối tất cả bot
  bots.forEach(bot => {
    if (bot && !bot.ended) {
      bot.quit()
    }
  })
  
  bots = []
  completedBots = 0
  allBotsCompleted = false
}

// ========== HÀM KHỞI ĐỘNG LẠI TẤT CẢ BOT ==========
function restartAllBots() {
  if (isRestarting) return
  isRestarting = true
  
  console.log('🔄 Phát hiện bot bị disconnect, khởi động lại toàn bộ hệ thống...')
  
  stopAllBots()
  setTimeout(() => {},5000)
  // Đợi một chút trước khi khởi động lại
  setTimeout(() => {
    isRestarting = false
    console.log(`🟢 Bắt đầu khởi chạy lại ${botConfigs.length} bot...`)
    botConfigs.forEach((config, index) => {
      createBotWithDelay(config, index * 35000, index)
    })
  }, 30000)
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
      let count = 2
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

  // ========== XỬ LÝ SỰ KIỆN DISCONNECT/KICK ==========
  bot.on('kicked', (reason) => {
    console.log(`[${bot.username}] Bị kick:`, reason)
    restartAllBots()
  })
  
  bot.on('error', (err) => {
    console.log(`[${bot.username}] Lỗi:`, err)
    if (!isRestarting) {
      restartAllBots()
    }
  })
  
  bot.on('end', () => {
    console.log(`[${bot.username}] Đã ngắt kết nối`)
    if (!isRestarting) {
      // Kiểm tra xem có phải là disconnect tự nguyện không
      setTimeout(() => {
        if (!isRestarting && !bot.manuallyDisconnected) {
          restartAllBots()
        }
      }, 1000)
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
            }
          }, 1000)
        }, 1000)
      })
    }, 3000)
  }
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${botConfigs.length} bot...`)
botConfigs.forEach((config, index) => {
  createBotWithDelay(config, index * 35000, index)
})

// ========== XỬ LÝ TẮT SCRIPT ==========
process.on('SIGINT', () => {
  console.log('\n🛑 Đang tắt tất cả bot...')
  
  // Đánh dấu là disconnect tự nguyện để không trigger restart
  bots.forEach(bot => {
    bot.manuallyDisconnected = true
  })
  
  stopAllBots()
  setTimeout(() => process.exit(), 1000)
})