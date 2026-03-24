function rectangularCollision({ rectangle1, rectangle2 }) {
  return (
    rectangle1.attackBox.position.x + rectangle1.attackBox.width >=
    rectangle2.position.x &&
    rectangle1.attackBox.position.x <=
    rectangle2.position.x + rectangle2.width &&
    rectangle1.attackBox.position.y + rectangle1.attackBox.height >=
    rectangle2.position.y &&
    rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
  )
}

// Track if game already ended to prevent double-firing
let gameEnded = false

function determineWinner({ player, enemy, timerId, reason }) {
  if (gameEnded) return
  gameEnded = true

  clearTimeout(timerId)

  const displayText = document.querySelector('#displayText')
  displayText.style.display = 'flex'

  let winner = null
  if (reason) {
    // Custom reason (e.g. opponent left, game_over from server)
    displayText.innerHTML = reason
  } else if (player.health === enemy.health) {
    displayText.innerHTML = 'Tie'
    winner = 'tie'
  } else if (player.health > enemy.health) {
    displayText.innerHTML = 'You Win! 🏆'
    winner = 'player'
  } else {
    displayText.innerHTML = 'You Lose 💀'
    winner = 'enemy'
  }

  // Notify parent React app so it can emit game_over via socket
  window.parent.postMessage({
    type: 'GAME_OVER',
    winner: winner,
    playerHealth: player.health,
    enemyHealth: enemy.health
  }, '*')
}

// Called externally (from postMessage) to freeze the game and show result
window.endGame = function(reason) {
  if (gameEnded) return
  determineWinner({ player, enemy, timerId, reason })
}

let timer = 1800
let timerId
function decreaseTimer() {
  if (timer > 0) {
    timerId = setTimeout(decreaseTimer, 1000)
    timer--
    const minutes = Math.floor(timer / 60)
    const seconds = timer % 60
    document.querySelector('#timer').innerHTML =
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
  }

  if (timer === 0) {
    determineWinner({ player, enemy, timerId })
  }
}
