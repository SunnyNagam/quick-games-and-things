const config = {
    type: Phaser.AUTO,
    width: 660,
    height: 480,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        init: init,
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let bubbles;
let launcher;
let cursors;
let activeBubble;
let launcherSpeed = 600;
const bubbleColors = ['red', 'blue', 'green', 'yellow'];
const grid = {
    rows: 10,
    columns: 16,
    cellSize: 40,
    offsetX: 10,
    offsetY: 10
};


function init() {
    bubbles = [];
}

function preload() {
    bubbleColors.forEach(color => {
        this.load.image(`bubble-${color}`, `assets/bubble-${color}.png`);
    });
    this.load.image('launcher', 'assets/launcher.png');
}

function create() {
    launcher = this.physics.add.sprite(config.width / 2, config.height - 30, 'launcher');
    launcher.setOrigin(0.5, 0.5);
    launcher.body.setAllowGravity(false);
    launcher.setCollideWorldBounds(true);

    cursors = this.input.keyboard.createCursorKeys();

    this.input.on('pointerdown', shootBubble, this);

    activeBubble = createBubble(this);

    this.physics.world.setBoundsCollision(true, true, true, true);

    drawGrid(this);

    generateStartingBubbles(this);
}

function generateStartingBubbles(scene) {
    const startingRows = grid.rows / 2;
    for (let row = 0; row < startingRows; row++) {
        for (let column = 0; column < grid.columns; column++) {
            const chance = Phaser.Math.RND.between(0, 100);
            if (chance < 70) { // 70% chance to create a bubble
                const bubble = createBubbleAt(scene, row, column);
                bubbles.push(bubble);
            }
        }
    }
}

function createBubbleAt(scene, row, column) {
    const randomColor = Phaser.Math.RND.pick(bubbleColors);
    const x = column * grid.cellSize + grid.offsetX;
    const y = row * grid.cellSize + grid.offsetY;
    const bubble = scene.physics.add.sprite(x, y, `bubble-${randomColor}`);
    bubble.setOrigin(0.5, 0.5);
    bubble.body.setAllowGravity(false);
    bubble.body.setCollideWorldBounds(true);
    bubble.body.onWorldBounds=true;
    bubble.setBounce(1, 1);
    bubble.color = randomColor;
    createBubbleText(bubble, randomColor);

    return bubble;
}

function drawGrid(scene) {
    const graphics = scene.add.graphics({ lineStyle: { width: 1, color: 0xffffff, alpha: 0.5 } });

    // Draw horizontal lines
    for (let row = 0; row <= grid.rows; row++) {
        const y = row * grid.cellSize + grid.offsetY;
        graphics.moveTo(grid.offsetX, y);
        graphics.lineTo(grid.columns * grid.cellSize + grid.offsetX, y);
    }

    // Draw vertical lines
    for (let column = 0; column <= grid.columns; column++) {
        const x = column * grid.cellSize + grid.offsetX;
        graphics.moveTo(x, grid.offsetY);
        graphics.lineTo(x, grid.rows * grid.cellSize + grid.offsetY);
    }

    graphics.strokePath();
}

function update() {
    if (activeBubble) {
        activeBubble.x = launcher.x;
        activeBubble.y = launcher.y - launcher.height / 2;
    }

    // Update launcher angle to look at the mouse pointer
    const pointer = this.input.activePointer;
    launcher.angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(launcher.x, launcher.y, pointer.x, pointer.y)) + 90;
}


function shootBubble() {
    if (!activeBubble) {
        return;
    }

    const angle = Phaser.Math.Angle.BetweenPoints(launcher.getCenter(), this.input.activePointer.position);
    this.physics.velocityFromAngle(Phaser.Math.RadToDeg(angle), launcherSpeed, activeBubble.body.velocity);

    bubbles.push(activeBubble);
    activeBubble = null;

    this.time.delayedCall(250, () => {
        activeBubble = createBubble(this);
    });
}

function getClosestGridPosition(x, y) {
    const column = Math.round((x - grid.offsetX) / grid.cellSize);
    const row = Math.round((y - grid.offsetY) / grid.cellSize);
    return { row, column };
}

function placeBubbleInGrid(bubble, row, column) {
    const x = column * grid.cellSize + grid.offsetX;
    const y = row * grid.cellSize + grid.offsetY;

    bubble.x = x;
    bubble.y = y;

    bubble.text.x = x;
    bubble.text.y = y;
}

function handleBubbleCollision(bubble1, bubble2) {
    bubble1.setVelocity(0, 0);
    bubble1.setImmovable(true);
    bubble2.setVelocity(0, 0);
    bubble2.setImmovable(true);

    const closestGridPosition = getClosestGridPosition(bubble1.x, bubble1.y);
    placeBubbleInGrid(bubble1, closestGridPosition.row, closestGridPosition.column);
    const closestGridPosition2 = getClosestGridPosition(bubble2.x, bubble2.y);
    placeBubbleInGrid(bubble2, closestGridPosition2.row, closestGridPosition2.column);

    // Check for popping
    checkForPopping(bubble1);
    checkForPopping(bubble2);
}

function checkForPopping(bubble) {
    const visited = new Set();
    const colorToMatch = bubble.color;

    function visit(row, column) {
        if (row < 0 || row >= grid.rows || column < 0 || column >= grid.columns) {
            return [];
        }

        const index = row * grid.columns + column;
        if (visited.has(index)) {
            return [];
        }

        visited.add(index);

        const bubbleAtPosition = bubbles.find(b => {
            const gridPosition = getClosestGridPosition(b.x, b.y);
            return gridPosition.row === row && gridPosition.column === column;
        });

        if (!bubbleAtPosition || bubbleAtPosition.color !== colorToMatch) {
            return [];
        }

        const neighbors = [
            visit(row - 1, column), // Top
            visit(row + 1, column), // Bottom
            visit(row, column - 1), // Left
            visit(row, column + 1), // Right
            visit(row - 1, column - 1), // Top-left
            visit(row - 1, column + 1), // Top-right
            visit(row + 1, column - 1), // Bottom-left
            visit(row + 1, column + 1)  // Bottom-right
        ];

        return [bubbleAtPosition, ...neighbors.flat()];
    }

    const gridPosition = getClosestGridPosition(bubble.x, bubble.y);
    const connectedBubbles = visit(gridPosition.row, gridPosition.column);

    if (connectedBubbles.length >= 3) {
        connectedBubbles.forEach(b => {
            bubbles = bubbles.filter(bubble => bubble !== b);
            b.text.destroy();
            b.destroy();
        });

        // Disconnect floating bubbles
        disconnectFloatingBubbles();
    }
}

function getConnectedBubbles() {
    const visited = new Set();

    function visit(row, column) {
        if (row < 0 || row >= grid.rows || column < 0 || column >= grid.columns) {
            return [];
        }

        const index = row * grid.columns + column;
        if (visited.has(index)) {
            return [];
        }

        visited.add(index);

        const bubbleAtPosition = bubbles.find(b => {
            const gridPosition = getClosestGridPosition(b.x, b.y);
            return gridPosition.row === row && gridPosition.column === column;
        });

        if (!bubbleAtPosition) {
            return [];
        }

        const neighbors = [
            visit(row - 1, column), // Top
            visit(row + 1, column), // Bottom
            visit(row, column - 1), // Left
            visit(row, column + 1), // Right
            visit(row - 1, column - 1), // Top-left
            visit(row - 1, column + 1), // Top-right
            visit(row + 1, column - 1), // Bottom-left
            visit(row + 1, column + 1)  // Bottom-right
        ];

        return [bubbleAtPosition, ...neighbors.flat()];
    }

    const connectedBubbles = [];
    for (let column = 0; column < grid.columns; column++) {
        connectedBubbles.push(...visit(0, column));
    }

    return connectedBubbles;
}

function disconnectFloatingBubbles() {
    const connectedBubbles = getConnectedBubbles();
    const floatingBubbles = bubbles.filter(bubble => !connectedBubbles.includes(bubble));

    floatingBubbles.forEach(bubble => {
        bubbles = bubbles.filter(b => b !== bubble);
        bubble.text.destroy();
        bubble.setVelocity(0, 300); // You can adjust the falling speed
        bubble.body.setAllowGravity(true);
        bubble.body.setCollideWorldBounds(false);
    });
}

function handleWallCollision(bubble) {
    bubble.setVelocity(0, 0);
    bubble.setImmovable(true);

    const closestGridPosition = getClosestGridPosition(bubble.x, bubble.y);
    placeBubbleInGrid(bubble, closestGridPosition.row, closestGridPosition.column);
}

function createBubble(scene) {
    const randomColor = Phaser.Math.RND.pick(bubbleColors);
    const bubble = scene.physics.add.sprite(launcher.x, launcher.y - launcher.height / 2, `bubble-${randomColor}`);
    bubble.setOrigin(0.5, 0.5);
    bubble.body.setAllowGravity(false);
    bubble.body.setCollideWorldBounds(true);
    bubble.body.onWorldBounds=true;
    bubble.setBounce(1, 1);
    bubble.color = randomColor;
    createBubbleText(bubble, randomColor);

    scene.physics.world.on('worldbounds', (body, up, down, left, right)=>
    {
        if (body.gameObject === bubble && up) {
            handleWallCollision(bubble);
        }
    });

    scene.physics.add.overlap(bubble, bubbles, handleBubbleCollision, null, this);

    return bubble;
}

function createBubbleText(bubble, color) {
    const text = new Phaser.GameObjects.Text(bubble.scene, bubble.x, bubble.y, color.charAt(0).toUpperCase(), {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#fff',
        align: 'center'
    }).setOrigin(0.5);

    bubble.scene.add.existing(text);
    bubble.text = text;
}