Game.Loader.XML.Parser.ObjectParser = function(loader)
{
    Game.Loader.XML.Parser.call(this, loader);

    this.objects = {};
}

Engine.Util.extend(Game.Loader.XML.Parser.ObjectParser,
                   Game.Loader.XML.Parser,
{
    createConstructor: function(blueprint) {
        if (!blueprint.textures['__default'].texture) {
            console.error(blueprint);
            throw new Error('No default texture on blueprint');
        }

        var constructor = this.createObject(blueprint.id, blueprint.constr, function blueprintConstructor() {
            this.geometry = blueprint.geometries[0].clone();
            this.material = new THREE.MeshPhongMaterial({
                depthWrite: false,
                map: blueprint.textures['__default'].texture,
                side: THREE.DoubleSide,
                transparent: true,
            });

            blueprint.constr.call(this);

            this.name = blueprint.id;

            for (var i in blueprint.traits) {
                var trait = new blueprint.traits[i]();
                this.applyTrait(trait);
            }

            /* Run initial update of all UV maps. */
            for (var i in blueprint.animators) {
                var animator = blueprint.animators[i].clone();
                animator.addGeometry(this.geometry);
                animator.update();
                this.animators.push(animator);
            }

            for (var i in blueprint.collision) {
                var r = blueprint.collision[i];
                this.addCollisionRect(r.w, r.h, r.x, r.y);
            }
        });

        constructor.prototype.animations = blueprint.animations;
        constructor.prototype.textures = blueprint.textures;
        if (blueprint.animationRouter !== undefined) {
            constructor.prototype.routeAnimation = blueprint.animationRouter;
        }

        return constructor;
    },
    parse: function(objectsNode) {
        if (objectsNode.tagName !== 'objects') {
            throw new TypeError('Node not <objects>');
        }

        var texturesNode = objectsNode.getElementsByTagName('textures')[0];
        var textures = this.parseTextures(texturesNode);

        var animationsNode = objectsNode.getElementsByTagName('animations')[0];
        var animations = this.parseAnimations(animationsNode, textures);

        var objectNodes = objectsNode.getElementsByTagName('object');
        var objects = this.parseObjects(objectNodes, animations, textures);
        return objects;
    },
    parseObjects: function(objectNodes, animations, textures) {
        var objects = {};
        for (var i = 0, node; node = objectNodes[i++];) {
            var object = this.parseObject(node, animations, textures);
            var id = node.getAttribute('id');
            objects[id] = object;
        }
        return objects;
    },
    parseObject: function(objectNode, animations, textures) {
        var objectId = objectNode.getAttribute('id');
        var type = objectNode.getAttribute('type');
        var source = objectNode.getAttribute('source');

        var constr;
        if (type === 'character') {
            constr = Game.objects.characters[source] || Game.objects.Character;
        } else {
            constr = Engine.Object;
        }

        var blueprint = {
            id: objectId,
            constr: constr,
            animations: animations,
            animators: [],
            geometries: [],
            textures: textures,
            traits: null,
        };

        // For the local constructor
        /*
        for (var i = 0, l = this.animations.length; i < l; ++i) {
            if (this.animations[i].id) {
                animations[this.animations[i].id] = this.animations[i].animation;
            }
        }

        for (var i = 0, l = this.textures.length; i < l; ++i) {
            localTextures.push(this.textures[i].texture);
            if (this.textures[i].id) {
                localTextures[this.textures[i].id] = this.textures[i].texture;
            }
        }*/

        var geometryNodes = objectNode.getElementsByTagName('geometry');
        if (geometryNodes.length === 0) {
            throw new Error("No <geometry> defined in " + objectNode.outerHTML);
        }

        for (var i = 0, geometryNode; geometryNode = geometryNodes[i]; ++i) {
            var geometry = this.getGeometry(geometryNode);
            blueprint.geometries.push(geometry);

            var faceNodes = geometryNode.getElementsByTagName('face');
            for (var j = 0, faceNode; faceNode = faceNodes[j]; ++j) {
                var animator = new Engine.Animator.UV();
                animator.indices = [];
                animator.offset = this.getFloat(faceNode, 'offset') || 0;

                animator.name = faceNode.getAttribute('animation');
                if (!animator.name) {
                    throw new Error("No default animation defined");
                }
                if (!animations[animator.name]) {
                    throw new Error("Animation " + animator.name + " not defined");
                }
                var animation = animations[animator.name];

                animator.setAnimation(animation);
                this.parseRanges(faceNode, animator);

                var indexJSON = faceNode.getAttribute('index');
                if (indexJSON) {
                    var indices = JSON.parse(indexJSON);
                    Array.prototype.push.apply(animator.indices, indices);
                }

                if (animator.indices.length === 0) {
                    animator.indices = [j * 2];
                }

                blueprint.animators.push(animator);
            }

            if (!blueprint.animators.length) {
                var animator = new Engine.Animator.UV();
                animator.setAnimation(animations['__default']);
                animator.update();
                blueprint.animators.push(animator);
            }
        }

        blueprint.traits = this.parseTraits(objectNode);

        var animationRouterNode = objectNode.getElementsByTagName('animation-router')[0];
        if (animationRouterNode) {
            (function() {
                var animationRouter = undefined;
                eval(animationRouterNode.textContent);
                if (typeof animationRouter === "function") {
                    blueprint.animationRouter = animationRouter;
                }
            }());
        }

        blueprint.collision = this.parseCollision(objectNode);

        return this.createConstructor(blueprint);
    },
    parseAnimations: function(animationsNode, textures) {
        if (animationsNode.tagName !== 'animations') {
            throw new TypeError('Node not <animations>');
        }
        function getTexture(textureId) {
            if (textureId) {
                if (textures[textureId]) {
                    return textures[textureId];
                } else {
                    console.log(textures);
                    throw new Error('Texture "' + textureId + '" not defined');
                }
            } else if (textures['__default']) {
                return textures['__default'];
            } else {
                throw new Error('Default texture not defined');
            }
        }

        var textureId = animationsNode.getAttribute('texture');
        var texture = getTexture(textureId);

        var animationNodes = animationsNode.getElementsByTagName('animation');
        var animations = {
            __default: undefined,
        };
        for (var i = 0, node; node = animationNodes[i++];) {
            var animation = this.parseAnimation(node, texture);
            animations[animation.id || '__default'] = animation;
            if (animations['__default'] === undefined) {
                animations['__default'] = animation;
            }
        }

        return animations;
    },
    parseAnimation: function(animationNode, texture) {
        if (animationNode.tagName !== 'animation') {
            throw new TypeError('Expected <animation>, got ' + animationNode.tagName);
        }

        var id = animationNode.getAttribute('id');
        var group = animationNode.getAttribute('group');
        var animation = new Engine.Animator.Animation(id, group);
        var frameNodes = animationNode.getElementsByTagName('frame');
        for (var i = 0, frameNode; frameNode = frameNodes[i]; ++i) {
            var offset = this.getVector2(frameNode, 'x', 'y');
            var size = this.getVector2(frameNode, 'w', 'h') ||
                       this.getVector2(frameNode.parentNode, 'w', 'h') ||
                       this.getVector2(frameNode.parentNode.parentNode, 'w', 'h');
            var uvMap = new Engine.UVCoords(offset, size, texture.size);
            var duration = this.getFloat(frameNode, 'duration') || undefined;
            animation.addFrame(uvMap, duration);
        }

        return animation;
    },
    parseCollision: function(objectNode) {
        var collisionZones = [];
        var collisionNode = objectNode.getElementsByTagName('collision')[0];
        if (collisionNode) {
            var rectNodes = collisionNode.getElementsByTagName('rect');
            for (var rectNode, i = 0; rectNode = rectNodes[i++];) {
                collisionZones.push(this.getRect(rectNode));
            }
        }
        return collisionZones;
    },
    parseRanges: function(faceNode, animator) {
        var rangeNodes = faceNode.getElementsByTagName('range');
        var segs = this.getVector2(faceNode.parentNode, 'w-segments', 'h-segments') || new THREE.Vector2(1, 1);

        for (var rangeNode, i = 0; rangeNode = rangeNodes[i++];) {
            try {
                var range = {
                    'x': this.getRange(rangeNode, 'x', segs.x),
                    'y': this.getRange(rangeNode, 'y', segs.y),
                };
            } catch (e) {
                console.error('Range node %s range error (%d,%d)', rangeNode.outerHTML, segs.x, segs.y);
                throw e;
            }

            this.applyAnimationIndices(range, animator, segs);
        }
    },
    applyAnimationIndices: function(range, animator, segs) {
        var i, j, x, y, faceIndex;
        for (i in range.x) {
            x = range.x[i] - 1;
            for (j in range.y) {
                y = range.y[j] - 1;
                /* The face index is the first of the two triangles that make up a rectangular
                   face. The Animator.UV will set the UV map to the faceIndex and faceIndex+1.
                   Since we expect to paint two triangles at every index we need to 2x the index
                   count so that we skip two faces for every index jump. */
                faceIndex = (x + (y * segs.x)) * 2;
                animator.indices.push(faceIndex);
            }
        }
    },
    parseTextures: function(texturesNode) {
        var textures = {
            __default: undefined,
        };
        var textureNodes = texturesNode.getElementsByTagName('texture');
        for (var i = 0, node; node = textureNodes[i++];) {
            var textureId = node.getAttribute('id') || '__default';
            textures[textureId] = {
                id: textureId,
                texture: this.getTexture(node),
                size: this.getVector2(node, 'w', 'h'),
            };
            if (textures['__default'] === undefined) {
                textures['__default'] = textures[textureId];
            }
        }
        return textures;
    },
    parseTraits: function(objectNode) {
        var traits = [];
        var traitParser = new Game.Loader.XML.Parser.TraitParser();
        var traitsNode = objectNode.getElementsByTagName('traits')[0];
        if (traitsNode) {
            var traitNodes = traitsNode.getElementsByTagName('trait');
            for (var traitNode, i = 0; traitNode = traitNodes[i++];) {
                traits.push(traitParser.parseTrait(traitNode));
            }
        }
        return traits;
    }
});
