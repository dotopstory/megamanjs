var expect = require('expect.js');
var sinon = require('sinon');

var env = require('../../importer.js');

var Host = env.Engine.Object;
var World = env.Engine.World;
var Solid = env.Game.objects.Solid;
var Character = env.Game.objects.Character;
var Physics = env.Game.traits.Physics;

describe('Physics', function() {
  it('should bind to timeshift event of host', function() {
    var host = new Host();
    var physics = new Physics();
    physics.__timeshift = sinon.spy();
    host.applyTrait(physics);
    host.timeShift(0.08);
    expect(physics.__timeshift.callCount).to.equal(1);
    expect(physics.__timeshift.lastCall.args[0]).to.equal(0.08);
  });
  it('should honor world gravity', function() {
    var world = new World();
    var host = new Host();
    var physics = new Physics();
    world.gravityForce.set(0, 10);
    physics.mass = 1;
    host.applyTrait(physics);
    world.addObject(host);
    world.updateTime(0.1);
    expect(host.velocity.y).to.equal(-10);
  });
  it('mass should not affect velocity from gravity', function() {
    var world = new World();
    world.gravityForce.set(0, 10);

    var hosts = [
      new Host(),
      new Host(),
    ];

    hosts[0].applyTrait(new Physics());
    hosts[0].physics.mass = 1;

    hosts[1].applyTrait(new Physics());
    hosts[1].physics.mass = 100;

    world.addObject(hosts[0]);
    world.addObject(hosts[1]);

    world.updateTime(0.1);
    expect(hosts[0].velocity.y).to.equal(-10);
    expect(hosts[1].velocity.y).to.equal(-10);
  });
  it.skip('gravity pull should not be insignificantly affected by time step', function() {
    var step;
    var count;

    var worlds = [
      new World(),
      new World(),
    ];
    var hosts = [
      new Host(),
      new Host(),
    ];

    worlds[0].gravityForce.set(0, 10);
    hosts[0].applyTrait(new Physics());
    hosts[0].physics.mass = 1;
    worlds[0].addObject(hosts[0]);

    worlds[1].gravityForce.set(0, 10);
    hosts[1].applyTrait(new Physics());
    hosts[1].physics.mass = 1;
    worlds[1].addObject(hosts[1]);

    step = 1/120;
    count = 0;
    while (count++ < 120) {
      worlds[0].updateTime(step);
    }
    expect(hosts[0].position.y).to.be.within(-90.5, -90);

    step = 1/60;
    count = 0;
    while (count++ < 60) {
      worlds[1].updateTime(step);
    }
    expect(hosts[1].position.y).to.be.within(-90.5, -90);
  });
  it('should set host velocity when force excerted upon', function() {
    var world = new World();
    var host = new Host();
    var physics = new Physics();
    host.applyTrait(physics);
    physics.mass = 1;
    physics.force.set(10, 0);
    world.addObject(host);
    world.updateTime(0.1);
    expect(host.velocity.x).to.equal(10);
  });
});
