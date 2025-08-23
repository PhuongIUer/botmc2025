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

const bots = []

// ========== HÀM TẠO BOT ==========
function createBotWithDelay(config, delay, index) { // Thêm tham số index
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

    // Tắt cảnh báo partial packet
    bot._client.on('error', (err) => {
      if (err.message.includes('partial packet')) return
    })

    setupBotEvents(bot)
    bots.push(bot)
  }, delay)
}

// ========== THIẾT LẬP SỰ KIỆN BOT ==========
function setupBotEvents(bot) {
  let hasCompletedFirstTask = false
  let hasCompletedSecondTask = false
  let hasCompletedThirdTask = false
  let spawnCount = 0

  bot.on('spawn', async () => {
    spawnCount++
    console.log(`[${bot.username}] Đã spawn (lần ${spawnCount})`)
    
    // Nếu đã hoàn thành cả 3 task thì đứng im
    if (hasCompletedFirstTask && hasCompletedSecondTask && hasCompletedThirdTask)  {
      console.log(`[${bot.username}] Đã hoàn thành tất cả task, đứng im...`)
      return
    }

    // Spawn lần 1: làm task đầu tiên
    if (spawnCount === 1 && !hasCompletedFirstTask) {
      doFirstTask(bot)
    }
    // Spawn lần 2: làm task thứ hai và thứ ba
    else if (spawnCount >= 2 && hasCompletedFirstTask && !hasCompletedSecondTask) {
      doSecondTask(bot)
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
                
                // Đóng container
                setTimeout(() => {
                  if (bot.currentWindow) {
                    bot.closeWindow(bot.currentWindow)
                  }
                }, 1000)
                
              }, 2000)
            }
          }, 1000)
        }, 1000)
      })
    }, 3000)
  }

  // ========== TASK THỨ HAI ==========
  async function doSecondTask(bot) {
    console.log(`[${bot.username}] Bắt đầu task thứ hai...`)
    
    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    // Đi đến 159 53 -65
    const goal1 = new goals.GoalBlock(159, 53, -65)
    bot.pathfinder.setGoal(goal1)

    bot.once('goal_reached', async () => {
      console.log(`[${bot.username}] Đã tới vị trí (159, 53, -65)`)
      
      // Đợi 1 giây trước khi làm task 3
      setTimeout(() => {
        doThirdTask(bot)
      }, 1000)
    })
  }

  // ========== TASK THỨ BA ==========
  async function doThirdTask(bot) {
    console.log(`[${bot.username}] Bắt đầu task thứ ba...`)
    
    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    // Quay lại 146 51 -70
    const goal2 = new goals.GoalBlock(152, 51, -77)
    bot.pathfinder.setGoal(goal2)
    
    bot.once('goal_reached', async () => {
      console.log(`[${bot.username}] Đã quay lại vị trí (152, 51, -77)`)
      hasCompletedThirdTask = true
      hasCompletedSecondTask = true
      console.log(`[${bot.username}] ✅ Đã hoàn thành tất cả task, đứng im...`)
    })
  }

  bot.on('kicked', reason => console.log(`[${bot.username}] Bị kick:`, reason))
  bot.on('error', err => console.log(`[${bot.username}] Lỗi:`, err))
  bot.on('end', () => console.log(`[${bot.username}] Đã ngắt kết nối`))
}

// ========== KHỞI CHẠY TẤT CẢ BOT ==========
console.log(`🟢 Bắt đầu khởi chạy ${botConfigs.length} bot...`)
botConfigs.forEach((config, index) => {
  createBotWithDelay(config, index * 22000, index) // Thêm index làm tham số thứ 3
})

// ========== XỬ LÝ TẮT SCRIPT ==========
process.on('SIGINT', () => {
  console.log('\n🛑 Đang tắt tất cả bot...')
  bots.forEach(bot => bot.quit())
  setTimeout(() => process.exit(), 1000)
})