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

// ========== QUẢN LÝ TIN NHẮN CHAT ==========
const processedMessages = new Set()
const messageTimestamps = new Map()

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
      // Khi muốn ngắt kết nối bot thủ công (từ script)
      if (bot && typeof bot.quit === 'function') {
        bot.isQuit = true   // <--- đánh dấu là quit chủ động
        bot.quit()
        console.log(`[${bot.username}] Đã ngắt kết nối (do script)`)
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

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString()
}

function isDuplicateMessage(hash) {
  // Xóa tin nhắn cũ sau timeout
  const now = Date.now()
  for (const [msgHash, timestamp] of messageTimestamps.entries()) {
    if (now - timestamp > config.intervals.messageTimeout) {
      messageTimestamps.delete(msgHash)
      processedMessages.delete(msgHash)
    }
  }
  
  return processedMessages.has(hash)
}

function markMessageAsProcessed(hash) {
  processedMessages.add(hash)
  messageTimestamps.set(hash, Date.now())
}

// ========== HÀM XÓA TERMINAL CHO TERMUX ==========
function clearTerminal() {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

// ========== HÀM TẠO BOT ==========
function createBotWithDelay(botConfig, delay, index) {
  setTimeout(() => {
    console.log(`🚀 Khởi động bot: ${botConfig.username}`)
    
    const botOptions = {
      host: config.server.host,
      port: config.server.port,
      username: botConfig.username,
      version: config.server.version
    }

    const bot = mineflayer.createBot(botOptions)
    bot.loadPlugin(pathfinder)
    bot.botConfig = botConfig
    bot.botIndex = index // Thêm index để quản lý

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
      let count = 1
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

  // ========== PHẦN XỬ LÝ CHAT - CHỈ HIỂN THỊ [+] VÀ [-] ==========
  bot.on('message', (message) => {
    const chatMessage = message.toString().trim()
    
    // Bỏ qua tin nhắn rỗng hoặc của chính bot
    if (!chatMessage || chatMessage.includes(bot.username)) return
    
    // CHỈ HIỂN THỊ TIN NHẮN CÓ [+] HOẶC [-]
    const hasJoinLeave = chatMessage.includes('[+]') || chatMessage.includes('[-]')
    
    if (!hasJoinLeave) return
    
    // Kiểm tra xem tin nhắn này đã được xử lý bởi bot khác chưa
    const messageHash = simpleHash(chatMessage)
    const now = new Date()
    const timeString = now.toLocaleTimeString('vi-VN')
    // Nếu tin nhắn mới
    if (!isDuplicateMessage(messageHash)) {
      console.log(`💬 ${timeString} | ${chatMessage}`)
      markMessageAsProcessed(messageHash)
    }
  })

  bot.on('spawn', async () => {
    spawnCount++
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`)
    
    // Nếu đã hoàn thành task đầu tiên (spawn lần 2)
    if (spawnCount >= 2 && hasCompletedFirstTask) {
      completedBots++
      console.log(`[${bot.username}] ✅ Đã hoàn thành nhiệm vụ (${completedBots}/${config.botConfigs.length})`)

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
        
        bot.setQuickBarSlot(config.hotbar.initialSlot)
        console.log(`[${bot.username}] Đã cầm đồ ở ô thứ ${config.hotbar.initialSlot + 1}`)

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
              console.log(`[${bot.username}] Không mở dc HUB`)
            }
          }, 3000)
        }, 1000)
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
  
  bot.on('end', () => {
  if (!bot.isQuit) {
    console.log(`[${bot.username}] Đã ngắt kết nối (bất thường)`)
    resetAllBots()
  }
})
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${config.botConfigs.length} bot...`)
config.botConfigs.forEach((botConfig, index) => {
  createBotWithDelay(botConfig, index * config.intervals.botStartDelay, index)
})

// ========== XỬ LÝ TẮT SCRIPT ==========
process.on('SIGINT', () => {
  console.log('\n🛑 Đang tắt tất cả bot...')
  
  // Dọn dẹp interval toàn cục
  if (globalIntervalId) {
    clearInterval(globalIntervalId)
  }
  
  bots.forEach(bot => {
    bot.quit()
  })
  
  setTimeout(() => process.exit(), 1000)
})

