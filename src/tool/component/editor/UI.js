"use strict";

Editor.UI = function(editor)
{
    this.editor = editor;

    this.blankLevelURL = './resource/level-skeleton.xml';
    this.geometryInputDefault = '256x240/16';

    $(window)
        .on('resize', e => {
            const game = this.editor.game;
            if (game) {
                game.adjustResolution();
                game.adjustAspectRatio();
            }
        })
        .on('keydown keyup', e => {
            var k = e.which,
                t = e.type,
                c = e.ctrlKey,
                d = (t === 'keydown'),
                u = (t === 'keyup');

            if (k === 27 && d) { // ESC (reset)
                $(':input').blur();
                this.editor.items.deselect();
                this.editor.activeMode = editor.modes.view;
                this.console.hide();
                this.palette.hide();
            }
            else if ($(e.target).is(':input')) {
                return;
            }
            else {
                if (d && k === 107) { // -
                    e.preventDefault();
                    editor.camera.zoomOut();
                    return;
                }
                if (d && k === 109) { // +
                    e.preventDefault();
                    editor.camera.zoomIn();
                    return;
                }

                this.editor.activeMode(e);
            }
        });

    this.setupWorkspace();
    this.setupConsole();
    this.setupFileView();
    this.setupView();
    this.setupViewport();
    this.setupPlayback();
    this.setupItemView();
    this.setupPalette();
}

Editor.UI.prototype.applyState = function()
{
    this.item.snap.trigger('change');
    this.view.meta.trigger('change');
    this.view.layers.trigger('change');
    this.view.camera.obeyPaths.trigger('change');
    this.playback.simulate.trigger('change');
    this.playback.simulate.trigger('change');
    this.playback.simulationSpeed.trigger('change');
}

Editor.UI.prototype.loadLevel = function(url)
{
    this.editor.loadUrl(url).then(() => {
        this.file.recent.add(url);
        this.lastLoadedLevel = url;
        this.applyState();
    });
}

Editor.UI.prototype.createItem = function(type)
{
    const factory = this.editor.componentFactory;
    const layers = this.editor.ui.view.layers;

    if (type === 'cameraPath') {
        layers.cameraPath.on();
        return factory.createCameraPath();
    } else if (type === 'checkpoint') {
        layers.checkpoint.on();
        return factory.createCheckpoint();
    } else if (['deathzone', 'climbable', 'solid'].indexOf(type) > -1) {
        layers.behavior.on();
        const node = factory.nodeFactory.createBehavior(type, {x: 32, y: 16});
        return factory.createBehavior(node);
    } else if (type === 'object') {
        const geometryInput = prompt('Size', this.geometryInputDefault);
        if (!geometryInput) {
            return false;
        }
        this.geometryInputDefault = geometryInput;

        let s = geometryInput.split('/')[0].split('x'),
            m = parseFloat(geometryInput.split('/')[1]);

        let size = {
            x: parseFloat(s[0]),
            y: parseFloat(s[1]),
            sx: 1,
            sy: 1,
        }

        if (m !== undefined) {
            size['sx'] = Math.ceil(size.x / m);
            size['sy'] = Math.ceil(size.y / m);
        }

        layers.object.on();
        const objectNode = factory.nodeFactory.createObject(size);
        return editor.componentFactory.createObject(objectNode);
    }
}

Editor.UI.prototype.freeCamera = function()
{
unfollow = this.view.camera.unfollow;

    unfollow.trigger('click');
}

Editor.UI.prototype.mouseSelectItem = function(event, items)
{
    const bounds = this.viewport[0].getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    const camera = this.editor.camera.realCamera;
    const vector = new THREE.Vector3((event.layerX / bounds.width) * 2 - 1,
                                    -(event.layerY / bounds.height) * 2 + 1,
                                    -1); // z = - 1 important!

    vector.unproject(camera);
    vector.sub(camera.position);
    vector.normalize();
    raycaster.set(camera.position, vector);

    const distance = -(camera.position.z / vector.z);
    const pos = camera.position.clone().add(vector.multiplyScalar(distance));

    const intersectables = new Map;
    items.forEach(item => {
        intersectables.set(item.model, item);
    });

    const intersects = raycaster.intersectObjects([...intersectables.keys()]);
    if (intersects.length === 0) {
        return false;
    }

    return {
        item: intersectables.get(intersects[0].object),
        intersect: intersects[0],
    };
}

Editor.UI.prototype.paintUV = function(item, faceIndex)
{
    let paletteItem = editor.ui.palette.getSelectedAnimation();
    if (!paletteItem) {
        this.palette.show();
        return;
    }

    let object = item.object,
        geometry = object.geometry,
        node = item.sourceNode,
        geometryNode = $(node).find('> geometry'),
        faceNode = undefined;

    geometryNode.find('> face').each(function() {
        let node = $(this),
            nodeName = node.attr('animation'),
            indexJSON = node.attr('index'),
            indices = indexJSON ? JSON.parse(indexJSON) : [];

        for (;;) {
            let existingIndex = indices.indexOf(faceIndex);
            if (existingIndex === -1) {
                break;
            }
            console.log("Spliced faceIndex %d at index %d from %s", faceIndex, existingIndex, nodeName);
            indices.splice(existingIndex, 1);
        }

        node.attr('index', JSON.stringify(indices));

        if (nodeName === paletteItem.name) {
            faceNode = node;
        }
    });

    if (faceNode === undefined) {
        faceNode = $('<face>', editor.document).attr({
            'animation': paletteItem.name,
        });
        geometryNode.append(faceNode);
    }

    let indexJSON = faceNode.attr('index'),
        indices = indexJSON ? JSON.parse(indexJSON) : [];

    if (indices.indexOf(faceIndex) === -1) {
        indices.push(faceIndex);
        faceNode.attr('index', JSON.stringify(indices));
    }

    let animators = object.animators,
        selectedAnimator = undefined;
    for (let i = 0, l = animators.length; i !== l; ++i) {
        let animator = animators[i];
        for (;;) {
            let i = animator.indices.indexOf(faceIndex);
            if (i === -1) {
                break;
            }
            console.log("Clear index %d", i);
            animator.indices.splice(i, 1);
        }

        if (animator.name === paletteItem.name) {
            selectedAnimator = animator;
        }
    }

    if (selectedAnimator === undefined) {
        console.log("Adding faceIndex to animator", faceIndex);
        object.geometry.faceVertexUvs[0][faceIndex] = paletteItem.uvCoords[0];
        object.geometry.faceVertexUvs[0][faceIndex+1] = paletteItem.uvCoords[1];
        object.geometry.uvsNeedUpdate = true;
    }
    else {
        console.log("Adding faceIndex to animator", faceIndex);
        selectedAnimator.indices.push(faceIndex);
        selectedAnimator._currentIndex = undefined;
        selectedAnimator.update();
    }
}

Editor.UI.prototype.setupCamera = function()
{
    const C = this.view.camera = this.view.find('.camera');
    C.followSelected = C.find('button[name=followSelected]');
    C.followSelected.on('click', e => {
        this.editor.camera.followSelected();
    });
    C.unfollow = C.find('button[name=unfollow]');
    C.unfollow.on('click', e => {
        const camera = this.editor.camera.camera;
        camera.unfollow();
        camera.velocity.set(0,0,0);
    });
    C.obeyPaths = C.find(':input[name=obeyPaths]');
    C.obeyPaths.on('change', e => {
        this.editor.camera.camera.obeyPaths = this.checked;
    });
    C.zoom = C.find('button[name=zoom]').on('click', e => {
        let dir = parseFloat(e.target.getAttribute('dir'));
        if (dir < 0) {
            this.editor.camera.zoomOut();
        }
        else {
            this.editor.camera.zoomIn();
        }
    });
}

Editor.UI.prototype.setupConsole = function()
{
    const C = this.console = $('.console');
    C.textarea = C.find('textarea');
    C.find('button[name=close]').on('click', e => {
        C.hide();
    });
    C.find('button[name=generate-xml]').on('click', e => {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>' + this.editor.getXML();
        xml = vkbeautify.xml(xml);
        C.textarea.val(xml);
    });
    C.find('button[name=reload-xml]').on('click', e => {
        const node = $($.parseXML(C.textarea.val()));
        this.editor.load(node.find('> scene'));
    });
    C.hide = function() {
        C.addClass('hidden');
    };
    C.show = function() {
        C.removeClass('hidden');
    };
    C.toggle = function() {
        C.toggleClass('hidden');
    };

    this.workspace.find('button[name=toggleConsole]').on('click', e => {
        C.toggle();
    });
}

Editor.UI.prototype.setupFileView = function()
{
    /*editor.loader = {
        loadCharacterXml: function(src) {
            var game = editor.game,
                loader = new Game.Loader.XML(game);

            loader.loadObjects(src, function(objects, parser) {
                for (var characterId in objects) {
                    var character = new objects[characterId]();
                    character.position.copy(editor.marker.position);
                    character.position.z = 0;
                    game.scene.world.addObject(character);

                    var characterItem = new Editor.Item.Object(character);
                    editor.items.add(characterItem);
                }
            });
        }
    }*/


    let lastLoadedLevel = '';
    let lastLoadedCharacter = '../resource/characters/Megaman.xml';
    let currentSelection;

    const editor = this.editor;
    const element = $('.scene-editor .file');

    element.new = element.find('.level [name=new]')
        .on('click', () => {
            this.loadLevel(this.blankLevelURL);
        });

    element.load = element.find('.level [name=open]')
        .on('click', () => {
            const url = prompt("Source", lastLoadedLevel);
            if (url !== null && url.length) {
                this.loadLevel(url);
            }
        });

    element.loadCharacter = element.find('[name=loadCharacter]')
        .on('click', () => {
            const url = prompt("Source", lastLoadedCharacter);
            if (url !== null && url.length) {
                this.loadCharacterXml(url);
            }
        });

    element.recent = element.find('.level [name=recent]')
        .on('change', (e) => {
            const value = e.target.value;
            if (currentSelection === value || !value.length || !confirm("Load " + value + "?")) {
                e.preventDefault();
                return;
            }
            currentSelection = value;
            this.loadLevel(value);
        });

    element.recent.add = function(src) {
        var recent = this.get();
        for (;;) {
            var existingIndex = recent.indexOf(src);
            if (existingIndex === -1) {
                break;
            }
            recent.splice(existingIndex, 1);
        }
        recent.unshift(src);
        if (recent.length > 10) {
            recent.pop();
        }
        this.set(recent);
    }
    element.recent.get = () => {
        try {
            var json = editor.storage.getItem('recent');
            var recent = JSON.parse(json);
            var retval = Array.isArray(recent) ? recent : [];
            return retval;
        } catch(e) {
            console.error("Recent parsing failed: " + e.message);
            return [];
        }
    }
    element.recent.set = function(recent)
    {
        var json = JSON.stringify(recent);
        editor.storage.setItem('recent', json);
        this.updatelist();
    }
    element.recent.updatelist = function()
    {
        var recent = this.get();
        if (recent.length) {
            let fragment = document.createDocumentFragment();
            recent.forEach(function(src, index) {
                var opt = document.createElement('option');
                opt.innerHTML = src;
                opt.value = src;
                fragment.appendChild(opt)
            });
            element.recent.html(fragment);
        }
    }
    element.recent.loadLatest = function()
    {
        var recent = this.get();
        if (recent.length) {
            this.updatelist();
            editor.ui.loadLevel(recent[0]);
        }
    };

    this.file = element;
}

Editor.UI.prototype.setupItemView = function()
{
    const I = this.item = this.workspace.find('.item');

    I.inputs = I.find('.properties input[type=text]');
    I.inputs.on('keyup change', e => {
        const selected = this.editor.items.selected;
        if (selected.size === 0) {
            return;
        }

        const name = e.target.name;
        const value = parseFloat(e.target.value);

        if (!isFinite(value)) {
            return;
        }

        selected.forEach(item => {
            if (item[name] !== undefined) {
                item[name] = value;
            }
        });
    });
    I.inputs.clear = function() {
        this.each(function() {
            this.value = '';
            this.disabled = true;
        });
    }
    I.inputs.update = function(item) {
        this.each(function() {
            const value = item[this.name];
            if (value !== undefined) {
                this.value = value;
                this.disabled = false;
            }
            else {
                this.disabled = true;
            }
        });
    }
    I.snap = I.find('.properties input[name=snap]').on('change', e => {
        this.editor.grid.snap = this.checked;
    });

    I.create = I.find('.create');
    I.create.find('button').on('click', (e) => {
        const type = $(e.target).attr('type');
        this.createItem(type).then(item => {
            console.log(item);
            this.editor.items.insert(item);
        });
    });
}

Editor.UI.prototype.setupPalette = function()
{
    const P = this.palette = this.workspace.find('.palette');
    P.on('mousedown', '.animation', e => {
        if (e.buttons !== 1) {
            return;
        }

        const anim = $(e.target);
        anim.addClass('selected').siblings().removeClass('selected');

        console.log("Selected anim %s", P.getSelectedAnimation().name);

        setTimeout(() => {
            P.hide();
        }, 150);
    });
    P.getSelectedAnimation = () => {
        const node = P.find('> .animation.selected:first');
        if (node.length === 0) {
            return null;
        }
        return {
            name: node.attr('name'),
            uvCoords: node.data('uv-coords'),
        };
    }
    P.hide = () => {
        P.addClass('hidden');
    }
    P.show = () => {
        P.removeClass('hidden');
    }
    P.toggle = () => {
        P.toggleClass('hidden');
    }
}

Editor.UI.prototype.setupPlayback = function()
{
    const P = this.playback = this.workspace.find('.view');
    P.simulate = P.find('[name=simulate]');
    P.simulate.on('change', e => {
        const scene = this.editor.scene;
        if (e.target.checked) {
            scene.resumeSimulation();
        } else {
            scene.pauseSimulation();
        }
    });
    P.simulationSpeed = P.find('[name=simulationSpeed]');
    P.simulationSpeed.on('change', e => {
        const speed = parseFloat(e.target.value);
        this.editor.game.setPlaybackSpeed(speed);
    });
}

Editor.UI.prototype.setupView = function(node)
{
    const V = this.view = this.workspace.find('.view');

    this.setupCamera();

    V.meta = V.find('.meta :input[type=checkbox]');
    V.meta.on('change', e => {
        this.editor.layers[e.target.name].visible = e.target.checked;
    });

    V.layers = V.find('.layers :input[type=checkbox]');
    V.layers.on('change', e => {
        const checkbox = e.target;
        const items = this.editor.items.layers[checkbox.name];
        if (!items) {
            console.warn(`Layer ${checkbox.name} not in use`);
            return;
        }
        const route = {
            'lock0': 'lock',
            'lock1': 'unlock',
            'show1': 'show',
            'show0': 'hide',
        };
        const action = checkbox.getAttribute('what') + (checkbox.checked + 0);
        const func = route[action];
        items.forEach(item => {
            this.editor.items[func](item);
        });
    });
    V.layers.each(function() {
        let node = this,
            what = $(this).attr('what');

        node.toggle = function() {
            this.checked = !this.checked;
            $(this).trigger('change');
        }
        node.on = function() {
            if (!this.chacked) {
                this.checked = true;
                $(this).trigger('change');
            }
        }
        node.off = function() {
            if (this.chacked) {
                this.checked = false;
                $(this).trigger('change');
            }
        }
        if (what === 'show') {
            V.layers[this.name] = node;
        }
    });
}

Editor.UI.prototype.setupViewport = function()
{
    const viewport = this.viewport = this.workspace.find('.viewport');

    const editor = this.editor,
          ui = this;

    viewport.coords = viewport.find('.coords');

    const mouse = {
        pos: new THREE.Vector2(),
        event: undefined,
    }

    let lastPaintedFace = undefined;
    let wasDragged = false;

    this.workspace
        .on('mousemove', function(e) {
            if (e.buttons === 2) {
                const offset = new THREE.Vector2((mouse.event.clientX - e.clientX),
                                           -(mouse.event.clientY - e.clientY));
                offset.multiplyScalar(editor.camera.position.z / 200);
                editor.camera.nudge(offset);
            }
            else if (e.buttons === 1 && editor.activeMode === editor.modes.edit) {
                wasDragged = true;
                const selection = editor.items.selected;
                if (e.buttons === 1 && selection.size > 0) {
                    const pos = viewport.getPositionAtEvent(e.originalEvent, selection.first.position);
                    const diff = pos.clone().sub(mouse.pos);
                    selection.forEach(item => {
                        item.x += diff.x;
                        item.y += diff.y;
                    });
                    mouse.pos.copy(pos);
                }
            }
            else if (e.buttons === 1 && editor.activeMode === editor.modes.paint) {
                const selected = editor.items.selected;
                const item = ui.mouseSelectItem(e.originalEvent, [selected.first]);
                if (item) {
                    let faceIndex = item.intersect.faceIndex;
                    faceIndex -= faceIndex % 2;
                    if (faceIndex !== lastPaintedFace) {
                        ui.paintUV(item.item, faceIndex);
                        lastPaintedFace = faceIndex;
                    }
                }
                return;
            }
            mouse.event = e;
        })
        .on('mouseup', function(e) {
            if (wasDragged && editor.grid.snap) {
                editor.items.selected.forEach(item => {
                    editor.grid.snapVector(item);
                });
            }
            wasDragged = false;
            lastPaintedFace = undefined;
            editor.camera.centerGrid();
        })
        .on('mousewheel', function(e) {
            if (e.buttons !== 0) {
                return;
            }
            e.preventDefault();
            let d = e.originalEvent.deltaY;
            if (d < 0) {
                editor.camera.zoomOut();
            }
            else {
                editor.camera.zoomIn();
            }
        });

    viewport
        .on('mousedown', function(e) {
            mouse.event = e;

            if (e.buttons === 1 && editor.activeMode === editor.modes.paint) {
                const match = ui.mouseSelectItem(e.originalEvent, [editor.items.selected.first]);
                if (match) {
                    const faceIndex = match.intersect.faceIndex;
                    ui.paintUV(match.item, faceIndex - faceIndex % 2);
                }
                return;
            }

            if (e.buttons === 1) {
                const items = editor.items;
                const match = ui.mouseSelectItem(e.originalEvent, items.interactable);
                if (match) {
                    mouse.pos.copy(viewport.getPositionAtEvent(e.originalEvent, match.item.position));
                    if (!items.selected.has(match.item)) {
                        if (!e.ctrlKey) {
                            items.deselect();
                        }
                        editor.activeMode = editor.modes.edit;
                        items.select(match.item);

                        if (match.item.object instanceof Game.objects.Character) {
                            editor.game.player.setCharacter(match.item.object);
                            console.log("Selected character", match.item.object);
                        }
                    }
                    return;
                }
                else if (!e.ctrlKey) {
                    editor.activeMode = editor.modes.view;
                    items.deselect();
                }
            }

            if (e.buttons === 1) {
                const pos = viewport.getPositionAtEvent(e.originalEvent);
                mouse.pos.copy(pos);
                viewport.placeMarker(pos);
            }
        })
        .on('contextmenu', function(e) {
            e.preventDefault();
        })
        .on('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const item = ui.mouseSelectItem(e.originalEvent, editor.items.interactable);
            if (item && item.item.TYPE === "object") {
                editor.activeMode = editor.modes.paint;
                const mat = item.item.overlay.material;
                mat.color = new THREE.Color(Editor.Colors.overlayPaint);
                mat.needsUpdate = true;
            }
        })
        .on('drop', e => {
            e.preventDefault();
            const pos = this.viewport.getPositionAtEvent(e.originalEvent);
            const file = e.originalEvent.dataTransfer.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', e => {
                const image = new Image();
                image.addEventListener('load', e => {
                    const geometry = new THREE.PlaneGeometry(image.width, image.height);
                    const texture = new THREE.Texture(image);
                    const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        opacity: .5,
                        transparent: true,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    const item = new Editor.Item.Mesh(mesh);
                    texture.needsUpdate = true;
                    item.position.copy(pos);
                    this.editor.items.add(item);
                });
                image.src = e.target.result;
            });
            reader.readAsDataURL(file);
        });

    viewport.placeMarker = function(pos)
    {
        const marker = editor.marker;
        marker.position.copy(pos);
        if (editor.grid.snap) {
            editor.grid.snapVector(marker.position);
        }
        marker.position.z = 0;
        this.coords.find('.x > .value').text(marker.position.x.toFixed(2));
        this.coords.find('.y > .value').text(marker.position.y.toFixed(2));
    }

    viewport.getVectorAtEvent = function(event)
    {
        const bounds = this[0].getBoundingClientRect();
        return new THREE.Vector3((event.layerX / bounds.width) * 2 - 1,
                                -(event.layerY / bounds.height) * 2 + 1,
                                -1);
    }

    viewport.getPositionAtEvent = function(event, pos)
    {
        const camera = editor.camera.realCamera;
        const vector = this.getVectorAtEvent(event);
        vector.unproject(camera);
        vector.sub(camera.position);
        vector.normalize();
        const z = camera.position.z + (pos ? -pos.z : 0);
        const distance = -(z / vector.z);
        return camera.position.clone().add(vector.multiplyScalar(distance));
    }
}

Editor.UI.prototype.setupWorkspace = function()
{
    this.workspace = $('.workspace');

    this.workspace.on('dragover', e => {
         e.stopPropagation();
         e.preventDefault();
    });
}
