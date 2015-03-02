Engine.assets.Solid = function()
{
    Engine.assets.Object.call(this);
    this.buffer = new THREE.Vector2();
}

Engine.assets.Solid.prototype = Object.create(Engine.assets.Object.prototype);
Engine.assets.Solid.constructor = Engine.assets.Solid;

Engine.assets.Solid.prototype.TOP = 0;
Engine.assets.Solid.prototype.BOTTOM = 1;
Engine.assets.Solid.prototype.LEFT = 2;
Engine.assets.Solid.prototype.RIGHT = 3;

Engine.assets.Solid.prototype.collides = function(subject, ourZone, theirZone)
{
    if (subject instanceof Engine.assets.objects.Character === false) {
        return;
    }

    var our = new Engine.Collision.BoundingBox(this.model, ourZone);
    var their = new Engine.Collision.BoundingBox(subject.model, theirZone);

    var distances = [
        Math.abs(their.b - our.t),
        Math.abs(their.t - our.b),
        Math.abs(their.r - our.l),
        Math.abs(their.l - our.r),
    ];

    var dir = 0, l = 4, min = distances[dir];
    for (var i = 1; i < l; i++) {
        if (distances[i] < min) {
            min = distances[i];
            dir = i;
        }
    }

    switch (dir) {
        case this.TOP:
            their.bottom(our.t);
            break;
        case this.BOTTOM:
            their.top(our.b);
            break;
        case this.LEFT:
            their.right(our.l);
            break;
        case this.RIGHT:
            their.left(our.r);
            break;
    }

    subject.obstruct(this, dir);
}

Engine.assets.obstacles = {};
