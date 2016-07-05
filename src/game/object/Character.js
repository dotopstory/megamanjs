Game.objects.Character = function()
{
    Engine.Object.call(this);

    this.ai = new Engine.AI(this);
    this.dead = false;
    this.direction.x = this.DIRECTION_RIGHT;
}

Engine.Util.extend(Game.objects.Character, Engine.Object);

Game.objects.Character.prototype.EVENT_DAMAGE = 'damage';
Game.objects.Character.prototype.EVENT_DEATH = 'death';
Game.objects.Character.prototype.EVENT_RESURRECT = 'resurrect';

Game.objects.Character.prototype.kill = function()
{
    if (this.dead === true) {
        return;
    }

    this.dead = true;
    this.health.deplete();

    /* Notify object that something happened. */
    if (this.weapon) {
        this.weapon.__timeshift(0);
    }

    this.events.trigger(this.EVENT_DEATH);
    this.world.removeObject(this);
}

Game.objects.Character.prototype.resurrect = function()
{
    if (this.dead === false) {
        return;
    }

    this.dead = false;
    this.health.fill();
    this.events.trigger(this.EVENT_RESURRECT);
}

Game.objects.Character.prototype.routeAnimation = function()
{
    return undefined;
}

Game.objects.Character.prototype.timeShift = function(dt)
{
    if (this.aim.x !== 0) {
        this.direction.x = this.aim.x > 0 ? 1 : -1;
    }
    if (this.aim.y === 0) {
        this.direction.y = 0;
    }
    else {
        this.direction.y = this.aim.y > 0 ? 1 : -1;
    }

    this.setAnimation(this.routeAnimation());

    Engine.Object.prototype.timeShift.call(this, dt);
}

Game.objects.characters = {};
