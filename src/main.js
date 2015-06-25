var renderer = new THREE.WebGLRenderer();
renderer.setSize(800, 532);
document.getElementById('screen').appendChild(renderer.domElement);

var Megaman2 = function()
{
    this.engine = undefined;
    this.player = undefined;
    this.level = new Megaman2.LevelRunner(this);

    window.addEventListener('focus', function() {
        if (this.engine && !this.engine.isRunning) {
            this.engine.run();
        }
    }.bind(this));
    window.addEventListener('blur', function() {
        if (this.engine && this.engine.isRunning) {
            this.engine.pause();
        }
    }.bind(this));
}

Megaman2.prototype.loadLevel = function(xmlUrl)
{
<<<<<<< Updated upstream
	window.clearTimeout(this.levelLoadTimeout);
	this.engine.pause();
	this.engine.scene = undefined;
	Engine.scenes.Level.Util.loadFromXML(xmlUrl, function(level) {
		level.addObject(this.player.character, level.checkPoints[0].pos.x, level.checkPoints[0].pos.y);
		level.camera.follow(this.player.character);
		this.engine.scene = level;
		this.levelLoadTimeout = window.setTimeout(this.engine.run.bind(this.engine), 200);
	}.bind(this));
=======
    window.clearTimeout(this.levelLoadTimeout);
    this.engine.pause();
    this.engine.scene = undefined;
    Engine.scenes.Level.Util.loadFromXML(xmlUrl, function(level) {
        this.level.setLevel(level);
    }.bind(this));
>>>>>>> Stashed changes
}

Megaman2.Player = function()
{
    this.character = undefined;
    this.hud = undefined;
    this.input = undefined;
    this.lifes = 0;
    this.weapons = {};
}

Megaman2.Player.prototype.equipWeapon = function(code)
{
    var weapon = this.weapons[code];
    weapon.code = code;
    this.character.equipWeapon(weapon);
    this.hud.equipWeapon(weapon);
}

Megaman2.Player.prototype.setCharacter = function(character)
{
    this.character = character;
    this.character.isPlayer = true;
}

Megaman2.LevelRunner = function(game)
{
    this.game = game;
    this.level = undefined;
}

Megaman2.LevelRunner.prototype.setLevel = function(level)
{
    if (solid instanceof Engine.scenes.Level === false) {
        throw new Error('Invalid level');
    }

    this.unsetLevel();
    this.game.engine.scene = level;
    this.game.engine.run();
}

Megaman2.LevelRunner.prototype.unsetLevel = function()
{
    if (this.level === undefined) {
        return;
    }

    this.game.engine.pause();
    this.level = undefined;
}




var game = new Megaman2();
game.engine = new Engine(renderer);

game.player = new Megaman2.Player();
game.player.hud = new Hud($('#screen'));
game.player.weapons = {
    'p': new Engine.assets.weapons.Plasma(),
    'a': new Engine.assets.weapons.AirShooter(),
    'm': new Engine.assets.weapons.MetalBlade(),
    'c': new Engine.assets.weapons.CrashBomber()
};
game.player.setCharacter(new Engine.assets.objects.characters.Megaman());
game.player.hud.equipCharacter(game.player.character);
game.player.character.invincibilityDuration = 2;
game.player.input = new Engine.Keyboard();
game.player.equipWeapon('p');

game.player.input.intermittent(65,
    function() {
        game.player.character.moveLeftStart();
    },
    function() {
        game.player.character.moveLeftEnd();
    });
game.player.input.intermittent(68,
    function() {
        game.player.character.moveRightStart();
    },
    function() {
        game.player.character.moveRightEnd();
    });

game.player.input.intermittent(80,
    function() {
        game.player.character.jumpStart();
    },
    function() {
        game.player.character.jumpEnd();
    });
game.player.input.hit(79,
    function() {
        game.player.character.fire();
    });
game.player.input.hit(89,
    function() {
        game.engine.isSimulating = !game.engine.isSimulating;
    });

game.player.input.hit(33, function() {
    equipWeapon(weaponIndex[++weaponIndex.selected]);
});
game.player.input.hit(34, function() {
    equipWeapon(weaponIndex[--weaponIndex.selected]);
});

game.loadLevel('levels/flashman/Flashman.xml');


var pendelum = function(dt)
{
    this.momentum.x = Math.sin(this.time) * 20;
    Engine.assets.Object.prototype.timeShift.call(this, dt);
}

var circle = function(dt)
{
    var speed = 100;
    //this.momentum.x = Math.sin(this.time) * speed;
    this.momentum.y = Math.cos(this.time) * speed;
    //this.momentum.x += dt * 100;
    //this.momentum.y += dt;
    Engine.assets.Object.prototype.timeShift.call(this, dt);
}
