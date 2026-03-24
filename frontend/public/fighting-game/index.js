const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1024
canvas.height = 576

c.fillRect(0, 0, canvas.width, canvas.height)

const gravity = 0.7

const background = new Sprite({
  position: { x: 0, y: 0 },
  imageSrc: './img/background.png'
})

const shop = new Sprite({
  position: { x: 600, y: 128 },
  imageSrc: './img/shop.png',
  scale: 2.75,
  framesMax: 6
})

const player = new Fighter({
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  imageSrc: './img/samuraiMack/Idle.png',
  framesMax: 8,
  scale: 2.5,
  offset: { x: 215, y: 157 },
  sprites: {
    idle:   { imageSrc: './img/samuraiMack/Idle.png',   framesMax: 8 },
    run:    { imageSrc: './img/samuraiMack/Run.png',    framesMax: 8 },
    jump:   { imageSrc: './img/samuraiMack/Jump.png',   framesMax: 2 },
    fall:   { imageSrc: './img/samuraiMack/Fall.png',   framesMax: 2 },
    attack1:{ imageSrc: './img/samuraiMack/Attack1.png',framesMax: 6 },
    takeHit:{ imageSrc: './img/samuraiMack/Take Hit - white silhouette.png', framesMax: 4 },
    death:  { imageSrc: './img/samuraiMack/Death.png',  framesMax: 6 }
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 }
})

const enemy = new Fighter({
  position: { x: 400, y: 100 },
  velocity: { x: 0, y: 0 },
  color: 'blue',
  offset: { x: -50, y: 0 },
  imageSrc: './img/kenji/Idle.png',
  framesMax: 4,
  scale: 2.5,
  offset: { x: 215, y: 167 },
  sprites: {
    idle:   { imageSrc: './img/kenji/Idle.png',   framesMax: 4 },
    run:    { imageSrc: './img/kenji/Run.png',    framesMax: 8 },
    jump:   { imageSrc: './img/kenji/Jump.png',   framesMax: 2 },
    fall:   { imageSrc: './img/kenji/Fall.png',   framesMax: 2 },
    attack1:{ imageSrc: './img/kenji/Attack1.png',framesMax: 4 },
    takeHit:{ imageSrc: './img/kenji/Take hit.png', framesMax: 3 },
    death:  { imageSrc: './img/kenji/Death.png',  framesMax: 7 }
  },
  attackBox: { offset: { x: -170, y: 50 }, width: 170, height: 50 }
})

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowLeft: { pressed: false }
}

decreaseTimer()

function animate() {
  window.requestAnimationFrame(animate)
  c.fillStyle = 'black'
  c.fillRect(0, 0, canvas.width, canvas.height)
  background.update()
  shop.update()
  c.fillStyle = 'rgba(255, 255, 255, 0.15)'
  c.fillRect(0, 0, canvas.width, canvas.height)
  player.update()
  enemy.update()

  player.velocity.x = 0
  enemy.velocity.x = 0

  player.updateApproach()
  enemy.updateApproach()

  // player movement
  if (player.isApproaching || player.isAttacking) {
    // override
  } else if (keys.a.pressed && player.lastKey === 'a') {
    player.velocity.x = -5
    player.switchSprite('run')
  } else if (keys.d.pressed && player.lastKey === 'd') {
    player.velocity.x = 5
    player.switchSprite('run')
  } else {
    player.switchSprite('idle')
  }

  if (player.velocity.y < 0) player.switchSprite('jump')
  else if (player.velocity.y > 0) player.switchSprite('fall')

  // enemy movement
  if (enemy.isApproaching || enemy.isAttacking) {
    // override
  } else if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
    enemy.velocity.x = -5
    enemy.switchSprite('run')
  } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
    enemy.velocity.x = 5
    enemy.switchSprite('run')
  } else {
    enemy.switchSprite('idle')
  }

  if (enemy.velocity.y < 0) enemy.switchSprite('jump')
  else if (enemy.velocity.y > 0) enemy.switchSprite('fall')

  // player attacks enemy
  if (player.isAttacking && player.framesCurrent === 4) {
    enemy.takeHit()
    player.isAttacking = false
    if (player._pendingDamage !== undefined) {
      enemy.health = Math.max(0, enemy.health - player._pendingDamage)
      player._pendingDamage = undefined
    }
    gsap.to('#enemyHealth', { width: enemy.health + '%' })
  }

  // enemy attacks player
  if (enemy.isAttacking && enemy.framesCurrent === 2) {
    player.takeHit()
    enemy.isAttacking = false
    if (enemy._pendingDamage !== undefined) {
      player.health = Math.max(0, player.health - enemy._pendingDamage)
      enemy._pendingDamage = undefined
    }
    gsap.to('#playerHealth', { width: player.health + '%' })
  }

  if (enemy.health <= 0 || player.health <= 0) {
    determineWinner({ player, enemy, timerId })
  }
}

animate()

// MY character (samuraiMack/player) attacks — triggered when I solve a problem
window.triggerPlayerAttack = function(damage) {
  if (!player.dead) {
    player.attack(enemy)
    player._pendingDamage = damage
  }
}

// OPPONENT's character (kenji/enemy) attacks — triggered when opponent solves a problem
window.triggerEnemyAttack = function(damage) {
  if (!enemy.dead) {
    enemy.attack(player)
    enemy._pendingDamage = damage
  }
}

// Listen for postMessages from the React app
window.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data.type === 'PLAYER_ATTACK') {
    const damage = event.data.damage || 10
    window.triggerPlayerAttack(damage)
  }
  if (event.data.type === 'ENEMY_ATTACK') {
    const damage = event.data.damage || 10
    window.triggerEnemyAttack(damage)
  }
  if (event.data.type === 'END_GAME') {
    const reason = event.data.reason || 'Game Over'
    if (window.endGame) window.endGame(reason)
  }
})
