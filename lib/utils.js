function clearTerminal() {
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
}

function formatTime(date) {
  return date.toLocaleTimeString('vi-VN');
}

module.exports = {
  clearTerminal,
  formatTime
};