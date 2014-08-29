
// This snippet stops odd warnings from Firefox when loading JSON files using $.getJSON
$.ajaxSetup({beforeSend: function(xhr){
  if (xhr.overrideMimeType)
  {
    xhr.overrideMimeType("application/json");
  }
}
});

var PictJS = function(canvasId, layoutId, structureFile, layoutFile, classesFile) {
	var Pt0 = { 'x': 0, 'y': 0 };
	var defaultLinkFontPx = 15;
	var that = {};

	that.shapeTypes = {};
	that.linkTypes = {};

	that.highlightThing = undefined;
	that.highlighting = [];
	that.showPoints = 0;
	that.zoomLevel = 100;
	that.pan = { 'x': 0, 'y': 0 };
	that.structure = {};
	that.layout = {};
	that.classes = {};
	that.actions = [];  // Undoable actions
	that.currentAction = undefined;

	var canvas = document.getElementById(canvasId);
	var layoutTextarea = document.getElementById(layoutId);
	daveL = layoutTextarea;
	var ctx = canvas.getContext("2d");


	function s(x) { return JSON.stringify(x); }

	// Library functions, taken off the net, or by me
	var libs = createPictJsLibs();
	var roundRect = libs.roundRect
	that.roundRect = roundRect;
	var drawCurve = libs.drawCurve;
	var drawArrow = libs.drawArrow;
	var drawLineArrow = libs.drawLineArrow;

	var drawLine = libs.drawLine;
	var logger = libs.logger;

	// Generic functions
	function forEach(array, action) {
	  for (var i = 0; i < array.length; i++)
	    action(array[i]);
	}

	function filter(array, matcher) {
		var ans = [];
		for (var i = 0; i < array.length; i++ ) {
			if ( matcher(array[i]) ) {
				ans.push(array[i]);
			}
		}
		return ans;
	}

	function find(array, matcher) {
		var found = undefined;
		if ( array ) {
			for (var i = 0; i < array.length; i++) {
				if ( matcher(array[i]) ) {
					found = array[i];
					break;
				}
			};
		}
		return found;
	};

	function withId(id) {
		return function(thing) {
			return thing.id == id;
		};
	};

	function getShape(id) {
		return find(that.structure.shapes, withId(id));
	}

	// Functions to find shapes etc
	function getShapePos(shape) {
		return getShapeIdPos(shape.id);
	};

	function unscale(x) { return x / that.zoomLevel * 100; }
	function unscalePos(pos) { return { 'x': unscale(pos.x - that.pan.x), 'y': unscale(pos.y-that.pan.y) }; }

	function getShapeIdPos(shapeId) {
		var x = 0;
		var y = 0;
		var w = 200;
		var h = 200/1.62;
		var defaultedPos = true;
		var layout = find(that.layout.shapes, withId(shapeId));
		if ( layout ) {
			x = layout.x || 0;
			y = layout.y || 0;		
			w = layout.w || 200;
			h = layout.h || 200/1.62;
			defaultedPos = layout.defaultedPos;
		}
		var pos = { "x": x, "y": y, "w": w, "h": h, "defaultedPos": defaultedPos };
		return pos;
	};
	that.getShapeIdPos = getShapeIdPos;

	function getShapeLayout(shape) {
		var layout = find(that.layout.shapes, withId(shape.id))
		if ( typeof(layout) == 'undefined' ) {
			layout = {"id": shape.id, "x":0, "y":0};
			that.layout.shapes.push(layout);
		}
		return layout;
	};

	/**
	 * pt has { link, ptName }
	 */
	function getPointLayout(pt, defaultPos) {
		var layout = find(that.layout.links, withId(pt.link.id))
		var linkId = pt.link.id;
		var ptName = pt.ptName;
		if ( typeof(layout) == 'undefined' ) {
			layout = { "id": linkId, 'src': pt.link.src, 'dest': pt.link.dest };
			//logger.info('Creating point layout of '+JSON.stringify(layout));
			that.layout.links.push(layout);
		}
		if ( typeof(layout[ptName]) == 'undefined' ) {
			//logger.info('Creating point for '+ptName+' for pt '+s(pt));
			layout[ptName] = defaultPos || { 'x': 0, 'y': 0 };
		}
		var ans = layout[ptName];
		//logger.info('Found point layout '+ptName+' ans of '+s(ans)+' from layout of '+s(layout)+' for pt '+s(pt));
		return ans;
	};
	that.getPointLayout = getPointLayout;

	function findShapeLayout(shape) {
		return find(that.layout.shapes, withId(shape.id));
	}

	function findLink(links, link) {
		return find(links, withId(link.id));
	}

	function isPosInside(pos, shapePos) {
		if ( pos.x >= shapePos.x && pos.x <= shapePos.x+shapePos.w &&
			pos.y >= shapePos.y && pos.y <= shapePos.y+shapePos.h) {
			return true;
		} else {
			return false;
		}
	}

	function findShapeAt(pos) {
		var found = undefined;
		function matchShape(shape) {
			var shapePos = getShapePos(shape);
			if ( isPosInside(pos, shapePos)) {
				found = shape;
			}
		}
		forEach(that.structure.shapes, matchShape);
		return found;
	}

	function isSrcPoint(ptName) {
		return ptName == 'srcPt' || ptName == 'pt2';
	}

	function absolutePtCoords(link, ptName, pt) {
		var shapePos = undefined;
		var name;
		if ( isSrcPoint(ptName) ) {
			name = link.src;
		} else {
			name = link.dest;
		}
		shapePos = getShapeIdPos(name);
		if ( !shapePos ) {
			logger.warn("Found no shape pos, using name of "+name);
		} else if ( typeof(pt) == 'undefined' ) {
			logger.warn("Got no pt?  For ptName of "+ptName+" and link of "+s(link));
		}
		// logger.info('AbsCoords for '+ptName+" pt of "+s(pt)+' using '+s(shapePos));
		return { 'x': shapePos.x+pt.x, 'y': shapePos.y+pt.y };
	}

	function getShapeIdType(id) {
		var ans = getShapeType(getShape(id));
		if ( typeof(ans) == 'undefined' ) {
			logger.warn('Failed to find shape with id of '+id);
		}
		return ans;
	}
	that.getShapeIdType = getShapeIdType;

	function getShapeType(shape) {
		var ty = shape.shape || 'rect';
		var ans = that.shapeTypes[ty];
		if ( typeof(ans) == 'undefined' ) {
			logger.error('Shape type ['+ty+'] is not defined');
			that.shapeTypes[ty] = that.shapeTypes['rect'];
			return that.shapeTypes['rect'];
		} else {
			return ans;
		}
	}

	function getLinkType(link) {
		var lt = link.type || 'straight';
		var ans = that.linkTypes[lt];
		if ( typeof(ans) == 'undefined' ) {
			logger.error('Link type ['+lt+'] is not defined');
			return that.linkTypes['straight'];
		} else {
			return ans;
		}
	}

	function findPointAt(pos) {
		var found = undefined;
		function checkPoint(link, ptName, pt) {
			var r = unscale(4);
			if ( pt ) {
				apt = absolutePtCoords(link, ptName, pt);
				if ( pos.x >= apt.x-r && pos.x <= apt.x+r &&
					 pos.y >= apt.y-r && pos.y <= apt.y+r ) {
					found = found || { 'link': link, 'ptName': ptName, 'pt': pt };
				}
			}
		}
		forEach(that.structure.links, function (link) {
			link = mergedLink(link);
			var pointNames = getLinkType(link).getPointNames(link);
			forEach(pointNames, function(ptName) {
				checkPoint(link, ptName, link[ptName]);
			});
		});
		return found;
	}



	function clearCanvas()
	{
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

	/**
	 * Need pos so can do linear gradients
	 */
	function styleFrom(pos, style, reason) {
		if ( style ) {
			if ( typeof(style) == 'string' ) {
				return style;
			} else {
				if ( style.type == 'verticalGradient' ) {
					// Create a gradient
					var grd = ctx.createLinearGradient(pos.x,pos.y,pos.x,pos.y+pos.h);
					grd.addColorStop(0, style.color1);
					grd.addColorStop(1, style.color2);
					return grd;
				} else {
					return 'black';
				}
			}
		} else {
			if ( reason == 'font' ) {
				return 'black';
			} else {
				// Default: Create a nice default gradient fill
				var grd = ctx.createLinearGradient(pos.x,pos.y,pos.x,pos.y+pos.h);
				grd.addColorStop(0,"#ffffaa");
				grd.addColorStop(1,"white");
				return grd;
			}
		}
	}

	function setStyles(pos, shape) {
		ctx.strokeStyle = shape.fgColor || 'black';
		ctx.fillStyle = styleFrom(pos, shape.bgColor);
	}

	function applyClasses(shape, extraClasses) {
		var allClasses = [];
		if ( shape.classes ) {
			forEach(shape.classes, function (c) { allClasses.push(c); });
		}
		if ( extraClasses ) {
			forEach(extraClasses, function (c) { allClasses.push(c); });
		}
		if ( allClasses ) {
			var index = 0;
			while ( index < allClasses.length ) {
				var cls = allClasses[index];
				var clsDef = that.classes[cls];
				shape = $.extend(true, {}, clsDef, shape);
				logger.info('Applied class of '+cls+' of '+JSON.stringify(clsDef)+' to '+JSON.stringify(shape));
				index = index + 1;
			}
		}
		return shape;
	}

	function fontFrom(fontData, defaultPx) {
		defaultPx = defaultPx || 30;
		if ( fontData ) {
			var px = fontData.px || 20;
			var name = fontData.fontName || 'Arial';
			return { 'px': px, 'name': name, font: px+'px '+name };
		} else {
			return { 'px': defaultPx, 'name': 'Arial', font: defaultPx+'px Arial' };
		}
	}

	function isHighlighting(thing) {
		var index = 0;
		while ( index < that.highlighting.length ) {
			if ( that.highlighting[index].id == thing.id ) {
				return true;
			}
			index = index + 1;
		}
		return false;
	}

	function highlightShape(shape) {
		if ( that.highlightThing != shape ) {
			that.highlightThing = shape;
			that.highlighting = [shape];
			forEach(
				filter(
					that.structure.links,
					function (link) {
						return link.src == shape.id || link.dest == shape.id;
					}
				),
				function (link) {
					that.highlighting.push(link);
					var srcShape = find(that.structure.shapes, withId(link.src));
					var destShape = find(that.structure.shapes, withId(link.dest));
					if ( srcShape ) that.highlighting.push(srcShape);
					if ( destShape ) that.highlighting.push(destShape);
				}
			);
			redraw();
		}
	}

	function highlightLinkAndPoint(link, point) {
		if ( that.highlightThing != link ) {
			that.highlightThing = link;
			that.highlighting = [link];
			redraw();
		}
	}

	function clearHighlights() {
		var wantRedraw = false;
		if ( that.highlighting.length > 0 ) {
			wantRedraw = true;
		}
		that.highlightThing = undefined;
		that.highlighting = [];
		if ( wantRedraw ) {
			redraw();
		}
	}
	
	function getShapeLabel(shape) {
		if ( typeof(shape.label) != 'undefined' ) return shape.label;
		else return shape.id;
	}
	
	function fillMultilineText(label, midX, fontY, fontData) {
		var bits = label.split("\n");
		var index = 0;
		while ( index < bits.length ) {
			var bit = bits[index];
			
			// Centre the words
			var m = measureText(bit, fontData);
			// Centre the text horizontally
			var fontX = midX - m.width/2;

			ctx.fillText(bit, fontX, fontY);
			// Move down a line
			fontY += fontData.px;
			index++;
		}
	}

	function drawShape(shape) {
		var pos = getShapePos(shape);
		ctx.strokeStyle = shape.fgColor || 'black';
		ctx.fillStyle = styleFrom(pos, shape.bgColor, 'shape');

		getShapeType(shape).drawShape(ctx, shape, pos, isHighlighting(shape), that);
		if ( pos.defaultedPos ) {
			// Show if the shape has not been positioned on purpose in this place
			var unsetColor = '#ff5500';
			ctx.strokeStyle = unsetColor;
			for (var r = 0; r < 4; r++) {
				ctx.strokeRect(pos.x-r, pos.y-r, pos.w +r*2, pos.h +r*2);
			}
			ctx.stroke();
			r = 8;
			ctx.fillStyle = unsetColor;
			/*
			drawLine(ctx, pos.x+pos.w/2, pos.y+pos.h/2, pos.x, pos.y);
			drawLine(ctx, pos.x+pos.w/2, pos.y+pos.h/2, pos.x+pos.w, pos.y);
			drawLine(ctx, pos.x+pos.w/2, pos.y+pos.h/2, pos.x, pos.y+pos.h);
			drawLine(ctx, pos.x+pos.w/2, pos.y+pos.h/2, pos.x+pos.w, pos.y+pos.h);
			*/
		}

		drawShapeLabel(shape);
	}
	
	function drawShapeLabel(shape) {
		var pos = getShapePos(shape);
		var fontData = fontFrom(shape.font);
		var label = getShapeLabel(shape);

		// Draw some text
		ctx.fillStyle = styleFrom(pos, shape.fontColor, 'font');
		ctx.font = fontData.font;
		var m = measureText(label, fontData);
		var bits = label.split("\n");
		ctx.fontAlign='start';
		var fontY = pos.y + pos.h/2 - m.height/2 + fontData.px*.8;
		var fontX = pos.x + 4;
		if ( m.width < pos.w ) {
			// Centre the text horizontally
			fontX = pos.x + pos.w/2 - m.width/2;
			//logger.info('On '+shape.id+' made fontX of '+fontX+' from '+pos.x+', '+pos.w+', m='+m.width);
		}

		fillMultilineText(label, pos.x + pos.w/2, fontY, fontData);
	}

	function drawShapes() {
		if ( that.structure.shapes ) {
			var len = that.structure.shapes.length
			var index = 0;
			while (index < len) {
				drawShape(that.structure.shapes[index]);
				index = index + 1;
			}
		}
	}

	function drawLink(link, drawHighlights) {
		var fromPos = getShapeIdPos(link.src);
		var toPos = getShapeIdPos(link.dest);
		var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
		var destPt = absolutePtCoords(link, 'destPt', link.destPt);
		var last2Pts = [srcPt, destPt];

		// Choose colour of link
		ctx.strokeStyle = link.color || "black";
		ctx.fillStyle = ctx.strokeStyle;

		daveC = ctx;
		daveCanvas = canvas;

		getLinkType(link).drawLinkType(ctx, link, drawHighlights, last2Pts, that);

		// Put an arrow on the end?
		if ( link.end == 'arrow' ) {
			logger.debug('Drawing arrow on end of curve4 at '+JSON.stringify(last2Pts));
			ctx.fillStyle = ctx.strokeStyle;
			drawArrow(ctx, last2Pts[0].x, last2Pts[0].y, last2Pts[1].x, last2Pts[1].y);
		}
	}

	/**
	 * Merge in the layout data to the link
	 */
	function mergedLink(link) {
		var found = findLink(that.layout.links, link);
		if ( found ) {
			logger.debug('Found link in linksTo of '+JSON.stringify(found));
			// The true means deep extend, the {} means that we don't actually change link, but clone it into {}
			link = $.extend(true, {}, link, found);
			//link.pt2 = found.pt2 || link.pt2;
			//link.pt3 = found.pt3 || link.pt3;
		}
		return link;
	}

	function drawLinks(drawHighlights) {
		if ( that.structure.shapes ) {
			var len = that.structure.links.length
			var index = 0;
			while (index < len) {
				var link = that.structure.links[index];
				link = mergedLink(link);
				// logger.debug('Drawing merged link of '+JSON.stringify(link));
				drawLink(link, drawHighlights);
				index = index + 1;
			}
		}			
	}

	function drawLinkLabel(link) {
		var label = link.label;
		if ( label ) {
			//logger.info('Trying to draw label '+label+' for '+s(link));
			var points = getLinkType(link).getPoints(link);
			var fontPos = getLinkType(link).getLabelPos(link);

			var fontData = fontFrom(link.font, defaultLinkFontPx);
			ctx.font = fontData.font;

			var m = measureText(label, fontData);
			fontPos.y = fontPos.y;

			// Make sure people can read the label - make some "space" around it
			if ( isHighlighting(link) ) {
				ctx.fillStyle = "yellow";
			} else {
				ctx.fillStyle = "white";
			}

			fillMultilineText(label, fontPos.x-1, fontPos.y, fontData);
			fillMultilineText(label, fontPos.x+1, fontPos.y, fontData);
			fillMultilineText(label, fontPos.x, fontPos.y-1, fontData);
			fillMultilineText(label, fontPos.x, fontPos.y+1, fontData);

			var pos = {'x': points[0].x, 'y': points[0].y };
			ctx.fillStyle = styleFrom(pos, link.fontColor || link.color, 'font');
			fillMultilineText(label, fontPos.x, fontPos.y, fontData);
		}
	}

	function drawLinkLabels() {
		if ( that.structure.shapes ) {
			var len = that.structure.links.length
			var index = 0;
			while (index < len) {
				var link = that.structure.links[index];
				link = mergedLink(link);
				logger.debug('Drawing merged link of '+JSON.stringify(link));
				drawLinkLabel(link);
				index = index + 1;
			}
		}		
	}

	var zoomX = 15;
	var zoomY = 10;
	var zoomSz = 20;
	function drawZoomControls() {
		ctx.strokeStyle = 'black';
		ctx.fillStyle = 'black';
		var x = zoomX;
		var y = zoomY;
		var sz = zoomSz;
		ctx.strokeRect(x, y, sz, sz);
		drawLine(ctx, x+4, y+sz/2, x+sz-4, y+sz/2);
		drawLine(ctx, x+sz/2, y+4, x+sz/2, y+sz-4);

		ctx.font = '16px Arial';
		fillMultilineText(that.zoomLevel+"%", x+sz/2, y+sz+8+16, fontFrom(undefined, 16));

		y += sz*3;
		ctx.strokeRect(x, y, sz, sz);
		drawLine(ctx, x+4, y+sz/2, x+sz-4, y+sz/2);

		y += sz*2;
		ctx.strokeRect(x, y, sz, sz);
		drawLine(ctx, x+sz/2, y+4, x+sz/2, y+6);
		drawLine(ctx, x+sz/2, y+8, x+sz/2, y+sz-4);
	}

	function zoomButtonContainingPos(pos) {
		if ( pos.x >= zoomX && pos.x <= zoomX+zoomSz ) {
			if ( pos.y >= zoomY && pos.y <= zoomY+zoomSz ) {
				return {'action': 'zoomPlus'};
			} else if ( pos.y >= zoomY+zoomSz*3 && pos.y <= zoomY+zoomSz*3+zoomSz ) {
				return {'action': 'zoomMinus'};
			} else if ( pos.y >= zoomY+zoomSz*5 && pos.y <= zoomY+zoomSz*5+zoomSz ) {
				return {'action': 'snapshot'};
			} else {
				return undefined;
			}
		} else {
			return undefined;
		}
	}

	function redraw(noZoomControls)
	{
		// onsole.log('in redraw');
		var z = 1;
		ctx.setTransform(z, 0,  0, z,  0, 0);
		clearCanvas();

		// All drawing from this point on is scaled and shifted
		z = that.zoomLevel/100;
		ctx.setTransform(z, 0,  0, z,  that.pan.x, that.pan.y);
		drawLinks(true);  // Draw the highlights first, so we don't break other shapes from our yellow line outlines
		drawShapes();
		drawLinks(false);
		drawLinkLabels();

		z = 1;
		ctx.setTransform(z, 0,  0, z,  0, 0);
		if ( !noZoomControls ) {
			drawZoomControls();
		}
	};

	that.limitAbs = function(n, maxN) {
		if ( n < 0 ) return Math.max(-maxN, n);
		else return Math.min(maxN, n);
	}

	// Hook up for events
	function getMousePos(canvas, evt) {
	    var rect = canvas.getBoundingClientRect();
	    return {
	        x: evt.clientX - rect.left,
	        y: evt.clientY - rect.top
	    };
	}

	function doneAction() {
		that.actions.push(that.currentAction);
		if ( that.actions.length > 20 ) {
			that.actions.shift();
		}
		layoutTextarea.value = JSON.stringify(that.layout, undefined, 2);
		that.currentAction = undefined;
	};

	function applyPan(action, pos) {
		that.pan.x = pos.x - action.offsetPos.x;
		that.pan.y = pos.y - action.offsetPos.y;
		redraw();
	}

	function applyDraggingShape(action, pos) {
		var layout = getShapeLayout(action.shape)
		layout.x = pos.x - action.offsetPos.x;
		layout.y = pos.y - action.offsetPos.y;
		delete layout.defaultedPos;
		// Moved shape, possibly links are auto-positioning, so will need to change where the points are
		forEach(that.structure.links, function (link) {
			getLinkType(link).restrictPoints(link, that);
		});
		redraw();				
	}

	function applyDraggingPoint(action, pos) {
		var layout = getPointLayout(action.pt)
		//logger.info('Got point layout of '+s(layout)+' and action of '+s(action));
		layout.x = pos.x - action.offsetPos.x;
		layout.y = pos.y - action.offsetPos.y;
		var link = action.pt.link;
		// Dragging point so we are going to use a harsh clipping mechanism for our edge of shape clip
		if ( action.pt.ptName == 'srcPt' ) {
			getShapeIdType(link.src).restrictPointPos(layout, action.pt.link.src, that);
		} else if ( action.pt.ptName == 'destPt' ) {
			getShapeIdType(link.dest).restrictPointPos(layout, link.dest, that);
		}
		//logger.info('Dragging for link '+s(link));
		getLinkType(link).restrictPoints(link, that);
		redraw();
	}

	function mouseDragForCurrentAction(unscaledPos, pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'pan' ) {
				applyPan(action, pos);

			} else if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, unscaledPos);

			} else if ( action.action == 'draggingPoint' ) {
				applyDraggingPoint(action, unscaledPos);
			}
		}
	}

	function mouseUpForCurrentAction(unscaledPos, pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'pan' ) {
				applyPan(action, pos);
				doneAction();

			} else if ( action.action == 'zoomPlus' ) {
				if ( that.zoomLevel >= 100 ) {
					that.zoomLevel += 10;
				} else if ( that.zoomLevel >= 10 ) {
					that.zoomLevel += 10;
				} else {
					that.zoomLevel += 1;
				}
				redraw();
				doneAction();

			} else if ( action.action == 'zoomMinus' ) {
				if ( that.zoomLevel > 100 ) {
					that.zoomLevel -= 10;
				} else if ( that.zoomLevel > 10 ) {
					that.zoomLevel -= 10;
				} else if ( that.zoomLevel > 1 ) {
					that.zoomLevel -= 1;
				}
				redraw();
				doneAction();

			} else if ( action.action == 'snapshot' ) {
				clearHighlights();
				redraw(true);
				var image = canvas.toDataURL("image/png");
				redraw();
				window.open(image);

			} else if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, unscaledPos);
				doneAction();

			} else if ( action.action == 'draggingPoint' ) {
				applyDraggingPoint(action, unscaledPos);
				doneAction();

			} else {
				logger.error("Unknown action type: "+action.action);
			}
		}
	};

	var isMouseDown = false;

	function fadeOutLinePoints() {
		if ( that.showPoints > 0 && that.resetShowPointsAt < (new Date()).getTime() ) {
			if ( that.showPoints <= 0.1 ) {
				that.showPoints = 0;
			} else {
				that.showPoints -= 0.2;
			}
			redraw();
		}
	}

	function showLinePoints() {
		if ( that.showPoints == 0 ) {
			that.showPoints = 1;
			that.resetShowPointsAt = (new Date()).getTime() + 1600;
			redraw();
		}
	}

	$(canvas).mousedown(function(e) {
		// Only respond to left button
		if ( e.which == 1 ) {
			isMouseDown = true;
			var pos = getMousePos(canvas, e);

			var zoomAction = zoomButtonContainingPos(pos);

			// All other things we could click on are subject to zoom scale
			var scaledPos = unscalePos(pos);
			var draggingShape = findShapeAt(scaledPos);
			var draggingPoint = findPointAt(scaledPos);
			if ( zoomAction ) {
				that.currentAction = zoomAction;
			} else if ( draggingPoint ) {
				//logger.info('Dragging point '+s(draggingPoint));
				var offsetPos = {
					'x': scaledPos.x-draggingPoint.pt.x,
					'y': scaledPos.y-draggingPoint.pt.y
				};
				that.currentAction = {
					'action': 'draggingPoint',
					'pt': draggingPoint,
					'offsetPos': offsetPos
				};

			} else if ( draggingShape ) {
				//onsole.log('Down on shape '+draggingShape.id);
				var shapePos = getShapePos(draggingShape);
				var offsetPos = {
					'x': scaledPos.x-shapePos.x,
					'y': scaledPos.y-shapePos.y
				};
				that.currentAction = { 
					'action': 'draggingShape',
					'shape': draggingShape,
					'offsetPos': offsetPos 
				};
			} else {
				var offsetPos = {
					'x': pos.x - that.pan.x,
					'y': pos.y - that.pan.y
				};
				that.currentAction = {
					'action': 'pan',
					'offsetPos': offsetPos
				};
			}
		}
	});

	$(canvas).mousemove(function(e) {
		showLinePoints();

		var pos = getMousePos(canvas, e);
		var scaledPos = unscalePos(pos);
		if ( isMouseDown ) {
			mouseDragForCurrentAction(scaledPos, pos);
			//onsole.log('Drag at '+pos.x+', '+pos.y);
		} else {
			// mouseover: Highlight the shape under the mouse, if not already highlighted
			var shape = findShapeAt(scaledPos);
			var point = findPointAt(scaledPos);
			if ( point ) {
				highlightLinkAndPoint(point.link, point);
			} else if ( shape ) {
				highlightShape(shape);
			} else {
				clearHighlights();
			}
			// var pos = getMousePos(canvas, e);
			//onsole.log('Move at '+pos.x+', '+pos.y);
		}
	});

	$(window).mouseup(function(e) {
		if ( isMouseDown ) {
			isMouseDown = false;
			var pos = getMousePos(canvas, e);
			var scaledPos = unscalePos(pos);
			if ( that.currentAction ) {
				mouseUpForCurrentAction(scaledPos, pos);
			}
		}
	});

	/// FIX stuff

	function fixLinksTo(shape) {
		if ( shape.linksTo ) {
			// logger.info('Fixing linksTo of '+JSON.stringify(shape.linksTo));
			var index = 0;
			while ( index < shape.linksTo.length ) {
				var link = shape.linksTo[index];
				//logger.info('Fixing link of '+JSON.stringify(link));
				if ( typeof(link) == 'string' ) {
					link = { 'dest': link };
					//shape.linksTo[index] = link;
				}
				link.src = shape.id;
				that.structure.links.push(link);
				
				index = index + 1;
			}
			delete shape.linksTo;
		}
	}

	var uniqueLinkNames = {};
	function fixLinks() {
		var errors = '';
		var index = 0;
		while ( index < that.structure.links.length ) {
			var link = that.structure.links[index];
			if ( typeof(link.id) == 'undefined' ) {
				var label = link.label || '';
				link.id = link.src+'-'+label+'-'+link.dest;
			}
			if ( typeof(uniqueLinkNames[link.id]) != 'undefined' ) {
				errors += 'Duplicate link id found of ['+link.id+'].  '
			}
			uniqueLinkNames[link.id] = 1;
			link = applyClasses(link, that.structure.defaultLinkClasses);
			that.structure.links[index] = link;
			//logger.info('Fixed link to '+JSON.stringify(link));
			
			index = index + 1;
		}
		if ( errors != '' ) {
			logger.error('Errors: '+errors);
		}
	}

	function min(a,b) { if ( a < b ) { return a; } else { return b; } }

	var maxShapePosSoFar = {'x':canvas.width/2 || 100, 'y':20};
	var autoPlacementRow = 0;
	var autoPlacementXDivisors = [0.5, 0.3, 0.6, 0.15, 0.75, 0.05];

	function measureText(label, fontData) {
		var bits = label.split("\n");
		// Get longest bit of label
		var bit = bits[0];
		var index = 0;
		while ( index < bits.length ) {
			if ( bit.length < bits[index].length ) {
				bit.length = bits[index].length;
			}
			index++;
		}
		// logger.info('Measuring bit of '+bit+' from bits of '+s(bits));
		ctx.font = fontData.font;
		var m = ctx.measureText(bit);
		return { 'width': m.width, 'height': fontData.px*bits.length }
	}
	
	function defaultShapePos(shape) {
		var fontData = fontFrom(shape.font);
		var label = getShapeLabel(shape);
		ctx.font = fontData.font;
		var m = measureText(label, fontData);
		var layout = find(that.layout.shapes, withId(shape.id));
		var incMaxShapePos = false;
		if ( typeof(layout) == 'undefined' ) {
			logger.info("Defaulting shape pos for "+shape.id+" with m of "+s(m));
			layout = {};
			getShapeType(shape).defaultSize(layout, m);
			logger.info("Now have layout of "+s(layout));
			// Compute where we think is a good place to put this shape
			// Try to find a spot that is not already too near to another shape?
			var div = autoPlacementXDivisors[autoPlacementRow];
			var x = maxShapePosSoFar.x;
			var y = maxShapePosSoFar.y;
			if ( y+layout.h > canvas.height ) {
				// Move to next auto-placement row
				if ( autoPlacementRow < autoPlacementXDivisors.length-1 ) {
					autoPlacementRow++;
				}
				div = autoPlacementXDivisors[autoPlacementRow];
				maxShapePosSoFar.x = canvas.width*div;
				maxShapePosSoFar.y = div*10;
				x = maxShapePosSoFar.x;
				y = maxShapePosSoFar.y;				
			}
			incMaxShapePos = true;
			layout.id = shape.id;
			layout.x = x;
			layout.y = y;
			layout.x = layout.x-layout.w/2;  // centre it
			layout.defaultedPos = true;
			that.layout.shapes.push(layout);			
			logger.info('Made layout of '+s(layout));
		} else {
			getShapeType(shape).defaultSize(layout, m);
		}
		if ( incMaxShapePos ) {
			maxShapePosSoFar.y += layout.h+20;
		}
		// logger.info("Set size of shape "+shape.id+" to "+s(layout)+" using font of "+s(fontData));
	}

	function fromToDefaultEdges(fromPos, toPos) {
		var fx,fy, tx,ty;
		// logger.info('Checking fromTo of '+s(fromPos)+' vs '+s(toPos));
		if ( fromPos.y+fromPos.h < toPos.y ) {
			// From is above to
			fy = fromPos.h;
			ty = 0;
		} else {
			fy = 0;
			ty = toPos.h/2;
		}
		if ( fromPos.x < toPos.x ) {
			fx = fromPos.w/2;
			tx = 0;
		} else {
			fx = 0;
			tx = toPos.w/2;
		}
		return { 'fx': fx, 'fy': fy, 'tx': tx, 'ty': ty };
	}

	function fixLayoutLinkIds() {
		var index = 0;
		while ( index < that.layout.links.length ) {
			var link = that.layout.links[index];
			if ( typeof(link.id) == 'undefined' ) {
				link.id = link.src+'-'+link.dest;
			}
			that.layout.links[index] = link;
			//logger.info('Fixed layout link to '+JSON.stringify(link));
			index = index + 1;
		}
	}

	function fixLayout() {
		fixLayoutLinkIds();

		var selfOffsets = {};
		var index = 0;
		while ( index < that.structure.links.length ) {
			var layout;
			var link = that.structure.links[index];
			var defaultEdges = fromToDefaultEdges(getShapeIdPos(link.src), getShapeIdPos(link.dest));

			// Link to self must be curved or something, straight will not do
			if ( link.src == link.dest && (!link.type || link.type == 'straight' || link.type == 'autoStraight') ) {
				link.type = 'curve4';
			}

			var pos = getShapeIdPos(link.src);
			var offset = selfOffsets[link.src] || {'x': -50, 'y': 4};
			if ( link.src == link.dest && link.type == 'curve4' ) {
				// Line to self, make a nice loop
				var h = pos.h;
				layout = getPointLayout({'link': link, 'ptName': 'srcPt'}, {'x': 0, 'y': h/2-offset.y/2});
				getShapeIdType(link.src).restrictPointPos(layout, link.src, that);
				layout = getPointLayout({'link': link, 'ptName': 'destPt'}, {'x': 0, 'y': h/2+offset.y/2});
				getShapeIdType(link.dest).restrictPointPos(layout, link.dest, that);
				layout = getPointLayout({'link': link, 'ptName': 'pt2'}, {'x': offset.x, 'y': h/2-offset.y});
				layout = getPointLayout({'link': link, 'ptName': 'pt3'}, {'x': offset.x, 'y': h/2+offset.y});
				var fontData = fontFrom(link.font, defaultLinkFontPx);
				selfOffsets[link.src] = {'x': offset.x-50, 'y': offset.y+fontData.px+1};
			} else {
				// Line to a different shape
				layout = getPointLayout({'link': link, 'ptName': 'srcPt'}, {'x': defaultEdges.fx, 'y': defaultEdges.fy});
				getShapeIdType(link.src).restrictPointPos(layout, link.src, that);
				layout = getPointLayout({'link': link, 'ptName': 'destPt'}, {'x': defaultEdges.tx, 'y': defaultEdges.ty});
				getShapeIdType(link.dest).restrictPointPos(layout, link.dest, that);

				// Which extra points do we need to setup?
				var pointNames = getLinkType(link).getPointNames();
				pointNames.shift();
				pointNames.pop();
				var lastPtName = undefined;
				if ( pointNames.length > 1 ) {
					// Last point is locked to dest shape, must restrict points after they all exist
					lastPtName = pointNames.pop();
				}

				var x = 30 +10*index;
				var y = pos.h+50 + 8*index;
				forEach(pointNames, function(ptName) {
					layout = getPointLayout({'link': link, 'ptName': ptName}, {'x': x, 'y': y});
					y += 10;
				});

				// Must fix the links in the order given by the linkType object
				if ( lastPtName ) {
					layout = getPointLayout({'link': link, 'ptName': lastPtName}, {'x': -40, 'y': -50});
				}
				getLinkType(link).restrictPoints(link, that);
			}

			// logger.info('Fixed pts for '+s(link));
			index = index + 1;
		}
	}

	// Read the structureFile and layoutFile into structure and layout
	// console.log('Loading '+structureFile);

	var loadedStructure = false;
	var loadedLayout = false;
	var loadedClasses = false;

	var uniqueShapeNames = {};
	function fixStructure() {
		if ( loadedStructure && loadedLayout && loadedClasses ) {
			var errors = '';
			var index = 0;
			while ( index < that.structure.shapes.length ) {
				var shape = that.structure.shapes[index];
				if ( typeof(shape) == 'string' ) {
					shape = { 'id': shape };
				}
				if ( typeof(shape.id) == 'undefined' ) {
					shape.id = shape.label || 'undefined';
				}
				if ( typeof(uniqueShapeNames[shape.id]) != 'undefined' ) {
					errors += 'Duplicate shape id found of ['+shape.id+'].  ';
				}
				uniqueShapeNames[shape.id] = 1;
				fixLinksTo(shape);
				shape = applyClasses(shape, that.structure.defaultShapeClasses);
				defaultShapePos(shape);
				that.structure.shapes[index] = shape;
				index = index +1;
			}

			if ( errors != '' ) {
				logger.error('Errors: '+errors);
			}

			fixLinks();
			fixLayout();
			daveS = that.structure;
			//	    	console.log('Updating structure to '+JSON.stringify(that.structure, undefined, 2));
			redraw();
		}

	}

	$.getJSON( structureFile)
	    .done(function(data) {
	    	that.structure = data;
			loadedStructure = true;
			fixStructure();
			logger.info('Loaded structure');
	    })
	     .error(function() { logger.error("Bad structure file"); });

	$.getJSON( layoutFile)
	    .done(function( data ) {
	    	that.layout = data;
			if ( typeof(that.layout.shapes) == 'undefined' ) {
				that.layout.shapes = [];
			}
			if ( typeof(that.layout.links) == 'undefined' ) {
				that.layout.links = [];
			}
			loadedLayout = true;
			logger.info('Loaded layout');
			//logger.info('Got layout of '+JSON.stringify(data));
			fixStructure();
	    })
	     .error(function() { logger.error("Bad layout file"); });

	$.getJSON( classesFile)
	    .done(function( data ) {
	    	that.classes = data;
			loadedClasses = true;
			logger.info('Loaded classes');
			fixStructure();
	    })
	     .error(function() { logger.error("Bad classes file"); });


	dave=that;

	function showLayout() {
		var json = JSON.stringify(that.layout, undefined, 2);
		return json;
	}

	function runEvery100ms() {
		// logger.info("Running after 100ms");
		fadeOutLinePoints();
		setTimeout(runEvery100ms, 100);
	}

	setTimeout(runEvery100ms, 100);

	that.showLayout = showLayout;

	function get4Points(link) {
		var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
		var destPt = absolutePtCoords(link, 'destPt', link.destPt);
		var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
		var pt3 = absolutePtCoords(link, 'pt3', link.pt3);
		var myPoints;
		myPoints = [
			srcPt.x, srcPt.y,
			pt2.x, pt2.y,
			pt3.x, pt3.y,
			destPt.x, destPt.y
		];
		return myPoints;
	}

	// Wrap up line types and shape types as objects, pluggable maybe, by "name"

	function makeCurve4() {
		var that = {};

		that.name = function() { return "curve4"; }
		that.getPointNames = function() { return ['srcPt', 'pt2', 'pt3', 'destPt']; }
		that.getPoints = function(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
			var pt3 = absolutePtCoords(link, 'pt3', link.pt3);
			return [srcPt, pt2, pt3, destPt];
		}
		that.getLabelPos = function(link) {
				var myPoints = get4Points(link);
				var pos = {'x': myPoints[2], 'y': myPoints[3]};
				return {
					'x': pos.x, 
					'y': pos.y-4
				};
		}
		that.restrictPoints = function(link, cThat) {}
		that.drawLinkType = function(ctx, link, drawHighlights, last2Pts, cThat) {
			// Draw a curvy line
			var myPoints = get4Points(link);
			last2Pts[0] = { 'x': myPoints[myPoints.length-4], 'y': myPoints[myPoints.length-3]};
			var showPoints = cThat.showPoints;
			if ( drawHighlights ) {
				if ( isHighlighting(link) ) {
					var oldSS = ctx.strokeStyle;
					ctx.strokeStyle = 'yellow';
					ctx.setLineWidth(5);
					drawCurve(ctx, myPoints, 'yellow'); //default tension=0.5
					ctx.setLineWidth(1);
					ctx.strokeStyle = oldSS;
				}
			} else {
				drawCurve(ctx, myPoints, showPoints); //default tension=0.5
				ctx.stroke();
			}			
		}
		return that;
	}

	function makeCurve3() {
		var that = {};

		function getCurve3Points(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
			var myPoints;
			myPoints = [
				srcPt.x, srcPt.y,
				pt2.x, pt2.y,
				destPt.x, destPt.y
			];
			return myPoints;
		}

		that.name = function() { return "curve3"; }
		that.getPointNames = function() { return ['srcPt', 'pt2', 'destPt']; }
		that.getPoints = function(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
			return [srcPt, pt2, destPt];
		}
		that.getLabelPos = function(link) {
				var myPoints = getCurve3Points(link);
				var pos = {'x': myPoints[2], 'y': myPoints[3]};
				return {
					'x': pos.x, 
					'y': pos.y-4
				};
		}
		that.restrictPoints = function(link, cThat) {}
		that.drawLinkType = function(ctx, link, drawHighlights, last2Pts, cThat) {
			// Draw a curvy line
			var myPoints = getCurve3Points(link);
			last2Pts[0] = { 'x': myPoints[myPoints.length-4], 'y': myPoints[myPoints.length-3]};
			var showPoints = cThat.showPoints;
			if ( drawHighlights ) {
				if ( isHighlighting(link) ) {
					var oldSS = ctx.strokeStyle;
					ctx.strokeStyle = 'yellow';
					ctx.setLineWidth(5);
					drawCurve(ctx, myPoints, 'yellow'); //default tension=0.5
					ctx.setLineWidth(1);
					ctx.strokeStyle = oldSS;
				}
			} else {
				drawCurve(ctx, myPoints, showPoints); //default tension=0.5
				ctx.stroke();
			}			
		}
		return that;
	}

	function makeAngle4() {
		var that = {};

		that.name = function() { return "curve4"; }
		that.getPointNames = function() { return ['srcPt', 'pt2', 'pt3', 'destPt']; }
		function getPoints(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
			var pt3 = absolutePtCoords(link, 'pt3', link.pt3);
			return [srcPt, pt2, pt3, destPt];
		}
		that.getPoints = getPoints;
		that.restrictPoints = function(link, cThat) {
			var srcShapePos = cThat.getShapeIdPos(link.src);
			var destShapePos = cThat.getShapeIdPos(link.dest);
			var srcPt = cThat.getPointLayout({'link': link, 'ptName': 'srcPt'});
			var destPt = cThat.getPointLayout({'link': link, 'ptName': 'destPt'});
			var pt2 = cThat.getPointLayout({'link': link, 'ptName': 'pt2'});
			var pt3 = cThat.getPointLayout({'link': link, 'ptName': 'pt3'});

			if ( srcPt.x == 0 || srcPt.x == srcShapePos.w ) {
				// Left or right
				pt2.y = srcPt.y;  // x is free
				// As pt2 is relative to srcPt but pt3 is relative to destPt then the y coord is a bit strange
				pt3.x = pt2.x + (srcShapePos.x - destShapePos.x);
				pt3.y = destPt.y;
			} else if ( srcPt.y == 0 || srcPt.y == srcShapePos.h ) {
				// Top or bottom
				pt2.x = srcPt.x;
				// As pt2 is relative to srcPt but pt3 is relative to destPt then the y coord is a bit strange
				pt3.y = pt2.y + (srcShapePos.y - destShapePos.y);
				pt3.x = destPt.x;
			}
		}
		that.getLabelPos = function(link) {
				var myPoints = get4Points(link);
				var pos = {'x': myPoints[2], 'y': myPoints[3]};
				return {
					'x': pos.x, 
					'y': pos.y-4
				};
		}
		function drawAllPoints(ctx, points) {
			var index = 1;
			var prev = points[0];
			while ( index < points.length-1 ) {
				var point = points[index];
				drawLine(ctx, prev.x, prev.y, point.x, point.y);
				prev = point;
				index++;
			}
			var point = points[points.length-1];
			drawLine(ctx, prev.x, prev.y, point.x, point.y);
		}
		that.drawLinkType = function(ctx, link, drawHighlights, last2Pts, cThat) {
			// Draw a right angled line
			var myPoints = get4Points(link);
			last2Pts[0] = { 'x': myPoints[myPoints.length-4], 'y': myPoints[myPoints.length-3]};
			var showPoints = cThat.showPoints;
			if ( drawHighlights ) {
				if ( isHighlighting(link) ) {
					var oldSS = ctx.strokeStyle;
					ctx.strokeStyle = 'yellow';
					ctx.setLineWidth(5);
					drawAllPoints(ctx, getPoints(link));
					ctx.setLineWidth(1);
					ctx.strokeStyle = oldSS;
				}
			} else {
				drawAllPoints(ctx, getPoints(link));
				ctx.stroke();
			}			

			var showPoints = cThat.showPoints;
			if (showPoints > 0) {
				ctx.beginPath();
				var oldFS = ctx.fillStyle;
				ctx.save();
				ctx.globalAlpha = showPoints;
				var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
				ctx.fillRect(pt2.x - 2, pt2.y - 2, 4, 4);
				// var pt3 = absolutePtCoords(link, 'pt3', link.pt3);
				// ctx.fillRect(pt3.x - 2, pt3.y - 2, 4, 4);
				ctx.stroke();
				ctx.restore();
			}

		}

		return that;
	}

	function makeStraight(autoPosition) {
		var that = {};
		that.name = function() { if (autoPosition) return "autoStraight"; else return "straight"; }
		that.getPointNames = function() { return ['srcPt', 'destPt']; }
		that.getPoints = function(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			return [srcPt, destPt]; 
		}
		that.restrictPoints = function(link, cThat) {
			if ( autoPosition ) {
				// Make the start/end points the centre of the shapes
				var srcShape = cThat.getShapeIdType(link.src);
				var destShape = cThat.getShapeIdType(link.dest);
				var srcShapePos = cThat.getShapeIdPos(link.src);
				var destShapePos = cThat.getShapeIdPos(link.dest);
				// srcPt is relative to the src shape pos, destPt to dest shape
				var cx1 = srcShapePos.x + srcShapePos.w/2;
				var cy1 = srcShapePos.y + srcShapePos.h/2;
				var cx2 = destShapePos.x + destShapePos.w/2;
				var cy2 = destShapePos.y + destShapePos.h/2;

				var srcPt = cThat.getPointLayout({'link': link, 'ptName': 'srcPt'});
				var deltasToEdge = srcShape.deltasToEdge(cx1, cy1, cx2, cy2, link.src, cThat);
				srcPt.x = srcShapePos.w/2 + deltasToEdge.dx;
				srcPt.y = srcShapePos.h/2 + deltasToEdge.dy;

				var destPt = cThat.getPointLayout({'link': link, 'ptName': 'destPt'});
				deltasToEdge = destShape.deltasToEdge(cx2, cy2, cx1, cy1, link.dest, cThat);
				destPt.x = destShapePos.w/2 + deltasToEdge.dx;
				destPt.y = destShapePos.h/2 + deltasToEdge.dy;

				logger.info('DAVEDAVE: Auto setting edges for link '+link.id+' using '+s({'deltasToEdge': deltasToEdge, 'cx1':cx1, 'cy1':cy1, 'cx2': cx2, 'cy2':cy2, 'srcPt': srcPt, 'destPt': destPt})); 

				// Re-restrict the src/dest positions
				//cThat.getShapeIdType(link.src).restrictPointPos(srcPt, link.src, cThat);
				//cThat.getShapeIdType(link.dest).restrictPointPos(destPt, link.dest, cThat);
			}
		}
		that.getLabelPos = function(link) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			return {
				'x': (srcPt.x + destPt.x)/2,
				'y': (srcPt.y + destPt.y)/2
			};
		}
		that.drawLinkType = function(ctx, link, drawHighlights, last2Pts, that) {
			var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
			var destPt = absolutePtCoords(link, 'destPt', link.destPt);
			if ( drawHighlights ) {
				if ( isHighlighting(link) ) {
					var oldSS = ctx.strokeStyle;
					ctx.strokeStyle = 'yellow';
					ctx.setLineWidth(5);
					drawLine(ctx, srcPt.x, srcPt.y, destPt.x, destPt.y);
					ctx.setLineWidth(1);
					ctx.strokeStyle = oldSS;
				}
			} else {
				drawLine(ctx, srcPt.x, srcPt.y, destPt.x, destPt.y);
			}
		}

		return that;
	}

	that.linkTypes['straight'] = makeStraight();
	that.linkTypes['autoStraight'] = makeStraight(true);
	that.linkTypes['curve4'] = makeCurve4();
	that.linkTypes['curve3'] = makeCurve3();
	that.linkTypes['angle4'] = makeAngle4();

	function makeRect(wantRounded) {
		var that = {};
		that.defaultSize = function(layout, m) {
			var fontHeight = m.height;
			var fontWidth = m.width;
			layout.w = fontWidth + fontHeight;
			layout.h = min(fontHeight*1.62*2, layout.w/1.62);
		}
		that.deltasToEdge = function(x1, y1, x2, y2, shapeId, cThat) {
			var pos = cThat.getShapeIdPos(shapeId);
			var w = pos.w;
			var h = pos.h;
			var angle = Math.atan2(y2-y1, x2-x1);
			var tanA = Math.abs(Math.tan(angle));
			var xSign = 1; if ( Math.abs(angle) > Math.PI/2 ) xSign = -1;
			var ySign = 1; if ( angle < 0 ) ySign = -1;
			var x1dash = w/2 / tanA * xSign;
			var y1dash = h/2 * tanA * ySign;
			logger.info('Data is '+s({'x2':x2, 'y2':y2, 'angle': angle, 'tan': Math.tan(angle), 'x1dash':x1dash, 'y1dash':y1dash}));
			x1dash = cThat.limitAbs(x1dash, w/2);
			y1dash = cThat.limitAbs(y1dash, h/2);
			// dx,dy are how much to shift the point so it will end up on the edge of our shape
			return { 'dx': x1dash, 'dy': y1dash };
		}
		that.restrictPointPos = function(layout, shapeId, cThat) {
			var pos = cThat.getShapeIdPos(shapeId);
			var dx = min(layout.x/pos.w, (pos.w-layout.x)/pos.w);
			var dy = min(layout.y/pos.h, (pos.h-layout.y)/pos.h);
			if ( dx < dy ) {
				// Nearer to an x side, so lock the x side to edge, allow y to move freely
				if ( layout.x < pos.w/2 ) layout.x = 0;
				else layout.x = pos.w;
			} else {
				if ( layout.y < pos.h/2 ) layout.y = 0;
				else layout.y = pos.h;
			}
			// Make sure not outside the edge
			if ( layout.x < 0 ) layout.x = 0;
			if ( layout.y < 0 ) layout.y = 0;
			if ( layout.x > pos.w ) layout.x = pos.w;
			if ( layout.y > pos.h ) layout.y = pos.h;
		}

		that.drawShape = function(ctx, shape, pos, highlighted, cThat) {
			if ( highlighted ) {
				ctx.save();
				ctx.strokeStyle = 'yellow';
				ctx.fillStyle = 'yellow';
				var r = 6;
				if ( wantRounded ) {
					cThat.roundRect(ctx, pos.x -r, pos.y -r, pos.w +r*2, pos.h +r*2, 6, true);
				} else {
					ctx.fillRect(pos.x -r, pos.y -r, pos.w +r*2, pos.h +r*2);
					ctx.strokeRect(pos.x -r, pos.y -r, pos.w +r*2, pos.h +r*2);
				}
				ctx.restore();
			}

			// Draw box
			if ( wantRounded ) {
				cThat.roundRect(ctx, pos.x, pos.y, pos.w, pos.h, 6, true);
			} else {
				ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
				ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);
			}
		}

		return that;
	}

	function makeCircle() {
		var that = {};
		that.defaultSize = function(layout, m) {
			var fontHeight = m.height;
			var fontWidth = m.width;
			layout.w = fontWidth*1.62 + fontHeight;
			layout.h = layout.w;
		}

		that.deltasToEdge = function(x1, y1, x2, y2, shapeId, cThat) {
			// TODO: Need to do deltasToEdge for circles
			var x1dash = 0;
			var y1dash = 0;
			return { 'dx': x1dash, 'dy': y1dash };
		}
		that.restrictPointPos = function(layout, shapeId, cThat) {
			var pos = cThat.getShapeIdPos(shapeId);
			var rad = pos.w/2;
			var dy = layout.y - rad;
			var dx = layout.x - rad;
			var angle = Math.atan2(dy, dx);
			layout.x = rad+Math.cos(angle)*rad;
			layout.y = rad+Math.sin(angle)*rad;
		}

		that.drawShape = function(ctx, shape, pos, highlighted, cThat) {
			var rad = pos.w/2;
			if ( highlighted ) {
				ctx.save();
				ctx.strokeStyle = 'yellow';
				ctx.fillStyle = 'yellow';
				var r = 6;
				ctx.beginPath();
				ctx.arc(pos.x+rad, pos.y+rad, rad + r, rad + r, 180);
				ctx.fill();
				ctx.stroke();
				ctx.restore();
			}

			ctx.beginPath();
			ctx.arc(pos.x+rad, pos.y+rad, rad, rad, 180);
			ctx.fill();
			ctx.stroke();
		}

		return that;
	}

	that.shapeTypes['rect'] = makeRect();
	that.shapeTypes['roundedRect'] = makeRect(true);
	that.shapeTypes['circle'] = makeCircle();

	return that;
};

function pictjs_at(canvasId, layoutId, structureFile, layoutFile, classesFile) {
	var pictJS = PictJS(canvasId, layoutId, structureFile, layoutFile, classesFile)
};

//console.log('done');


