const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

// ========== TẮT CẢNH BÁO PARTIAL PACKET ==========
process.setMaxListeners(50)
process.on('warning', (warning) => {
  if (warning.message.includes('partial packet')) return
})

// ========== DANH SÁCH BOT ==========
const botConfigs = [
  { username: 'nobody01', password: '11092003' },
  { username: 'nobody02', password: '11092003' },
  { username: 'nobody03', password: '11092003' },
  { username: 'nobody04', password: '11092003' },
]

const bots = []
let completedBots = 0
let allBotsCompleted = false
let globalIntervalId = null

// ========== QUẢN LÝ TIN NHẮN CHAT ==========
const processedMessages = new Set()
const messageTimestamps = new Map()
const MESSAGE_TIMEOUT = 5000 // 5 giây

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
    if (now - timestamp > MESSAGE_TIMEOUT) {
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
function createBotWithDelay(config, delay, index) {
  setTimeout(() => {
    console.log(`🚀 Khởi động bot: ${config.username}`)
    
    const botOptions = {
      host: 'luckyvn.com',
      port: 25565,
      username: config.username,
      version: '1.21.4'
    }

    const bot = mineflayer.createBot(botOptions)
    bot.loadPlugin(pathfinder)
    bot.botConfig = config
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
    
    // Nếu tin nhắn mới
    if (!isDuplicateMessage(messageHash)) {
      console.log(`💬 ${chatMessage}`)
      markMessageAsProcessed(messageHash)
    }
  })

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
            } else console.log(`[${bot.username}] Không mở dc HUB`)
          }, 3000)
        }, 1000)
      })
    }, 3000)
  }

  bot.on('kicked', reason => console.log(`[${bot.username}] Bị kick:`, reason))
  bot.on('error', err => console.log(`[${bot.username}] Lỗi:`, err))
  bot.on('end', () => console.log(`[${bot.username}] Đã ngắt kết nối`))
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${botConfigs.length} bot...`)
botConfigs.forEach((config, index) => {
  createBotWithDelay(config, index * 30000, index)
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