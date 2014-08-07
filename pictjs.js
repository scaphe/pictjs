
// This snippet stops odd warnings from Firefox when loading JSON files using $.getJSON
$.ajaxSetup({beforeSend: function(xhr){
  if (xhr.overrideMimeType)
  {
    xhr.overrideMimeType("application/json");
  }
}
});

var PictJS = function(canvasId, structureFile, layoutFile, classesFile) {
	var Pt0 = { 'x': 0, 'y': 0 };
	var that = {};

	that.highlightThing = undefined;
	that.highlighting = [];
	that.structure = {};
	that.layout = {};
	that.classes = {};
	that.actions = [];  // Undoable actions
	that.currentAction = undefined;


	function s(x) { return JSON.stringify(x); }

	// Library functions, taken off the net, or by me
	var libs = createPictJsLibs();
	var roundRect = libs.roundRect
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


	// Functions to find shapes etc
	function getShapePos(shape) {
		return getShapeIdPos(shape.id);
	};

	function getShapeIdPos(shapeId) {
		var x = 0;
		var y = 0;
		var w = 200;
		var h = 100;
		var layout = find(that.layout.shapes, withId(shapeId));
		if ( layout ) {
			x = layout.x || 0;
			y = layout.y || 0;				
		}
		var pos = {"x": x, "y": y, "w":w, "h":h};
		return pos;
	};

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
			logger.info('Creating point layout of '+JSON.stringify(layout));
			that.layout.links.push(layout);
		}
		if ( typeof(layout[ptName]) == 'undefined' ) {
			logger.info('Creating point for '+ptName+' for pt '+s(pt));
			layout[ptName] = defaultPos || { 'x': 0, 'y': 0 };
		}
		var ans = layout[ptName];
		//logger.info('Found point layout '+ptName+' ans of '+s(ans)+' from layout of '+s(layout)+' for pt '+s(pt));
		return ans;
	};

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
		if ( isSrcPoint(ptName) ) {
			shapePos = getShapeIdPos(link.src);
		} else {
			shapePos = getShapeIdPos(link.dest);
		}
		//logger.info('AbsCoords for '+s(pt)+' using '+s(shapePos));
		return { 'x': shapePos.x+pt.x, 'y': shapePos.y+pt.y };
	}

	function findPointAt(pos) {
		var found = undefined;
		function checkPoint(link, ptName, pt) {
			var r = 4;
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
			checkPoint(link, 'srcPt', link.srcPt || Pt0);
			checkPoint(link, 'destPt', link.destPt || Pt0);
			if ( link.type == 'curve4' ) {
				checkPoint(link, 'pt3', link.pt3);
				checkPoint(link, 'pt2', link.pt2);
			}
		});
		return found;
	}


	var canvas = document.getElementById(canvasId);
	var ctx = canvas.getContext("2d");


	function clearCanvas()
	{
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

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
				// Create a gradient
				var grd = ctx.createLinearGradient(pos.x,pos.y,pos.x,pos.y+pos.h);
				grd.addColorStop(0,"red");
				grd.addColorStop(1,"white");
				return grd;
			}
		}
	}

	function setStyles(pos, shape) {
		ctx.strokeStyle = shape.fgColor || 'black';
		ctx.fillStyle = styleFrom(pos, shape.bgColor);
	}

	function applyClasses(shape) {
		if ( shape.classes ) {
			var index = 0;
			while ( index < shape.classes.length ) {
				var cls = shape.classes[index];
				var clsDef = that.classes[cls];
				shape = $.extend(true, {}, shape, clsDef);
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
	
	function drawShape(shape) {
		var pos = getShapePos(shape);
		var fontData = fontFrom(shape.font);
		var label = shape.label || shape.id;

		if ( isHighlighting(shape) ) {
			ctx.fillStyle = 'yellow';
			var r = 6;
			ctx.fillRect(pos.x -r, pos.y -r, pos.w +r*2, pos.h +r*2);
		}

		ctx.strokeStyle = shape.fgColor || 'black';
		ctx.fillStyle = styleFrom(pos, shape.bgColor, 'shape');

		// Draw box
		ctx.fillRect(pos.x,pos.y,pos.w,pos.h);
		ctx.strokeRect(pos.x,pos.y,pos.w,pos.h);
		// roundRect(ctx, 200,10,100,80,5, true, true);

		// Draw some text
		ctx.fillStyle = styleFrom(pos, shape.fontColor, 'font');
		ctx.font = fontData.font;
		var m = ctx.measureText(label);
		var fontX = pos.x + 4;
		if ( m.width < pos.w ) {
			// Centre the text horizontally
			fontX = pos.x + pos.w/2 - m.width/2;
			//logger.info('On '+shape.id+' made fontX of '+fontX+' from '+pos.x+', '+pos.w+', m='+m.width);
		}
		var fontY = pos.y+fontData.px+4;
		fontY = pos.y + pos.h/2 + fontData.px/2 - 4;

		// Draw label
		ctx.fillText(label, fontX, fontY);


		// // Underline the text, by knowing how wide it is, note font is 30px, so is 30 high
		// ctx.strokeStyle="blue";
 		// 	ctx.beginPath();
		//  		ctx.moveTo(10,50);
		// ctx.lineTo(10+m.width, 50);
		// ctx.stroke();
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

	function getCurve4Points(link) {
		var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
		var destPt = absolutePtCoords(link, 'destPt', link.destPt);
		var pt2 = absolutePtCoords(link, 'pt2', link.pt2);
		var pt3 = absolutePtCoords(link, 'pt3', link.pt3);
		var myPoints;
		if ( pt2 != pt3 ) {
			myPoints = [
				srcPt.x, srcPt.y,
				pt2.x, pt2.y,
				pt3.x, pt3.y,
				destPt.x, destPt.y
			];
		} else {
			myPoints = [
				srcPt.x, srcPt.y,
				pt2.x, pt2.y,
				destPt.x, destPt.y
			];
		};
		return myPoints;
	}

	function drawLink(link) {
		var fromPos = getShapeIdPos(link.src);
		var toPos = getShapeIdPos(link.dest);
		var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
		var destPt = absolutePtCoords(link, 'destPt', link.destPt);
		var last2Pts = [srcPt, destPt];

		// Choose colour of link
		ctx.strokeStyle="black";

		if ( link.type == 'curve4' ) {
			// Draw a curvy line
			daveC = ctx;
			var myPoints = getCurve4Points(link);
			last2Pts[0] = { 'x': myPoints[myPoints.length-4], 'y': myPoints[myPoints.length-3]};
			var tension = 0.5;
			if ( isHighlighting(link) ) {
				var oldSS = ctx.strokeStyle;
				ctx.strokeStyle = 'yellow';
				var i;
				var hPts;
				hPts = myPoints.slice(0);
				for (i = 0; i < hPts.length; i+=2) {
					hPts[i]++;
				}
				drawCurve(ctx, hPts);
				hPts = myPoints.slice(0);
				for (i = 0; i < hPts.length; i+=2) {
					hPts[i]--;
				}
				drawCurve(ctx, hPts);
				hPts = myPoints.slice(0);
				for (i = 1; i < hPts.length; i+=2) {
					hPts[i]++;
				}
				drawCurve(ctx, hPts);
				hPts = myPoints.slice(0);
				for (i = 1; i < hPts.length; i+=2) {
					hPts[i]--;
				}
				drawCurve(ctx, hPts);
				ctx.strokeStyle = oldSS;
			}
			drawCurve(ctx, myPoints); //default tension=0.5
			//drawCurve(ctx, myPoints, tension);
			ctx.stroke();
		} else {

			// Default to 'straight'
			if ( isHighlighting(link) ) {
				var oldSS = ctx.strokeStyle;
				ctx.strokeStyle = 'yellow';
				drawLine(ctx, srcPt.x-1, srcPt.y, destPt.x-1, destPt.y);
				drawLine(ctx, srcPt.x, srcPt.y-1, destPt.x, destPt.y-1);
				drawLine(ctx, srcPt.x+1, srcPt.y, destPt.x+1, destPt.y);
				drawLine(ctx, srcPt.x, srcPt.y+1, destPt.x, destPt.y+1);

				ctx.strokeStyle = oldSS;
			}
			drawLine(ctx, srcPt.x, srcPt.y, destPt.x, destPt.y);
		}

		// Put an arrow on the end?
		if ( link.end == 'arrow' ) {
			logger.debug('Drawing arrow on end of curve4 at '+JSON.stringify(last2Pts));
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

	function drawLinks() {
		if ( that.structure.shapes ) {
			var len = that.structure.links.length
			var index = 0;
			while (index < len) {
				var link = that.structure.links[index];
				link = mergedLink(link);
				logger.debug('Drawing merged link of '+JSON.stringify(link));
				drawLink(link);
				index = index + 1;
			}
		}			
	}

	function drawLinkLabel(link) {
		var label = link.label;
		if ( label ) {
			logger.info('Trying to draw label '+label+' for '+s(link));
			var fontX;
			var fontY;
			if ( link.type == 'curve4' ) {
				var myPoints = getCurve4Points(link);
				var pos = {'x': myPoints[2], 'y': myPoints[3]};
				fontX = pos.x;
				fontY = pos.y-4;
			} else {
				// Straight line, put label in the centre
				var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt);
				var destPt = absolutePtCoords(link, 'destPt', link.destPt);
				fontX = (srcPt.x + destPt.x)/2;
				fontY = (srcPt.y + destPt.y)/2;
			}

			ctx.fillStyle = styleFrom(pos, link.fontColor, 'font');
			var fontData = fontFrom(link.font, 15);
			ctx.font = fontData.font;
			ctx.fillText(label, fontX, fontY);
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

	function redraw()
	{
		// onsole.log('in redraw');
		clearCanvas();

		drawShapes();
		drawLinks();
		drawLinkLabels();
	};

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
		that.currentAction = undefined;
	};

	function applyDraggingShape(action, pos) {
		var layout = getShapeLayout(action.shape)
		layout.x = pos.x - action.offsetPos.x;
		layout.y = pos.y - action.offsetPos.y;
		redraw();				
	}

	function restrictPointPos(layout, shapeId) {
		var pos = getShapeIdPos(shapeId);
		if ( layout.x < 0 ) layout.x = 0;
		if ( layout.y < 0 ) layout.y = 0;
		if ( layout.x > pos.w ) layout.x = pos.w;
		if ( layout.y > pos.h ) layout.y = pos.h;
	}

	function applyDraggingPoint(action, pos) {
		var layout = getPointLayout(action.pt)
		//logger.info('Got point layout of '+s(layout)+' and action of '+s(action));
		layout.x = pos.x - action.offsetPos.x;
		layout.y = pos.y - action.offsetPos.y;
		if ( action.pt.ptName == 'srcPt' ) {
			restrictPointPos(layout, action.pt.link.src);
		} else if ( action.pt.ptName == 'destPt' ) {
			restrictPointPos(layout, action.pt.link.dest);
		}
		redraw();
	}

	function mouseDragForCurrentAction(pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, pos);

			} else if ( action.action == 'draggingPoint' ) {
				applyDraggingPoint(action, pos);
			}
		}
	}

	function mouseUpForCurrentAction(pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, pos);
				doneAction();

			} else if ( action.action == 'draggingPoint' ) {
				logger.info('Applying draggingPoint');
				applyDraggingPoint(action, pos);
				doneAction();

			} else {
				logger.error("Unknown action type: "+action.action);
			}
		}
	};

	var isMouseDown = false;

	$(canvas).mousedown(function(e) {
		// Only respond to left button
		if ( e.which == 1 ) {
			isMouseDown = true;
			var pos = getMousePos(canvas, e);

			console.log('Down at '+pos.x+', '+pos.y);
			var draggingShape = findShapeAt(pos);
			var draggingPoint = findPointAt(pos);
			if ( false ) {

			} else if ( draggingPoint ) {
				//logger.info('Dragging point '+s(draggingPoint));
				var offsetPos = {
					'x': pos.x-draggingPoint.pt.x,
					'y': pos.y-draggingPoint.pt.y
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
					'x': pos.x-shapePos.x,
					'y': pos.y-shapePos.y
				};
				that.currentAction = { 
					'action': 'draggingShape',
					'shape': draggingShape,
					'offsetPos': offsetPos 
				};
			} else {
				that.currentAction = undefined;
			}
		}
	});

	$(canvas).mousemove(function(e) {
		var pos = getMousePos(canvas, e);
		if ( isMouseDown ) {
			mouseDragForCurrentAction(pos);
			//onsole.log('Drag at '+pos.x+', '+pos.y);
		} else {
			// mouseover: Highlight the shape under the mouse, if not already highlighted
			var shape = findShapeAt(pos);
			var point = findPointAt(pos);
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
			if ( that.currentAction ) {
				mouseUpForCurrentAction(pos);
			}
		}
	});

	function fixLinksTo(shape) {
		if ( shape.linksTo ) {
			logger.info('Fixing linksTo of '+JSON.stringify(shape.linksTo));
			var index = 0;
			while ( index < shape.linksTo.length ) {
				var link = shape.linksTo[index];
				//logger.info('Fixing link of '+JSON.stringify(link));
				if ( typeof(link) == 'string' ) {
					link = { 'dest': link, 'type': 'straight' };
					//shape.linksTo[index] = link;
				}
				link.src = shape.id;
				that.structure.links.push(link);
				
				index = index + 1;
			}
			delete shape.linksTo;
		}
	}

	function fixLinks() {
		var index = 0;
		while ( index < that.structure.links.length ) {
			var link = that.structure.links[index];
			if ( typeof(link.id) == 'undefined' ) {
				link.id = link.src+'-'+link.dest;
			}
			link = applyClasses(link);
			that.structure.links[index] = link;
			logger.info('Fixed link to '+JSON.stringify(link));
			
			index = index + 1;
		}
	}

	function fixLayout() {
		var index = 0;
		while ( index < that.layout.shapes.length ) {
			var shape = that.layout.shapes[index];
			that.layout.shapes[index] = shape;
			logger.info('Fixed layout shape to '+JSON.stringify(shape));
			index = index + 1;
		}

		index = 0;
		while ( index < that.layout.links.length ) {
			var link = that.layout.links[index];
			if ( typeof(link.id) == 'undefined' ) {
				link.id = link.src+'-'+link.dest;
			}
			that.layout.links[index] = link;
			logger.info('Fixed layout link to '+JSON.stringify(link));
			index = index + 1;
		}

		var selfOffsets = {};
		index = 0;
		while ( index < that.structure.links.length ) {
			var layout;
			var link = that.structure.links[index];
			if ( link.type == 'curve4' ) {
				var offset = selfOffsets[link.src] || {'x': -50, 'y': 0};
				if ( link.src == link.dest ) {
					var pos = getShapeIdPos(link.src);
					var h = pos.h;
					layout = getPointLayout({'link': link, 'ptName': 'srcPt'}, {'x': 0, 'y': h/2-offset.y});
					restrictPointPos(layout, link.src);
					layout = getPointLayout({'link': link, 'ptName': 'destPt'}, {'x': 0, 'y': h/2+offset.y});
					restrictPointPos(layout, link.src);
				} else {
					getPointLayout({'link': link, 'ptName': 'srcPt'});
					getPointLayout({'link': link, 'ptName': 'destPt'});
				}
				getPointLayout({'link': link, 'ptName': 'pt2'}, {'x': offset.x, 'y': h/2-offset.y});
				getPointLayout({'link': link, 'ptName': 'pt3'}, {'x': offset.x, 'y': h/2+offset.y});
				selfOffsets[link.src] = {'x': offset.x-50, 'y': offset.y+8};
			} else {
				getPointLayout({'link': link, 'ptName': 'srcPt'});
				getPointLayout({'link': link, 'ptName': 'destPt'});
			}
			logger.info('Fixed pts for '+s(link));
			index = index + 1;
		}
	}

	// Read the structureFile and layoutFile into structure and layout
	console.log('Loading '+structureFile);

	var loadedStructure = false;
	var loadedLayout = false;
	var loadedClasses = false;


	function fixStructure() {
		if ( loadedStructure && loadedLayout && loadedClasses ) {
			var index = 0;
			while ( index < that.structure.shapes.length ) {
				var shape = that.structure.shapes[index];
				fixLinksTo(shape);
				shape = applyClasses(shape);
				that.structure.shapes[index] = shape;
				index = index +1;
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
	     .error(function() { alert("error"); });

	$.getJSON( layoutFile)
	    .done(function( data ) {
	    	that.layout = data;
			loadedLayout = true;
			logger.info('Loaded layout');
			//logger.info('Got layout of '+JSON.stringify(data));
			fixStructure();
	    	redraw();
	    });

	$.getJSON( classesFile)
	    .done(function( data ) {
	    	that.classes = data;
			loadedClasses = true;
			logger.info('Loaded classes');
			fixStructure();
	    	redraw();
	    });

	dave=that;

	function showLayout() {
		var json = JSON.stringify(that.layout, undefined, 2);
		return json;
	}

	that.showLayout = showLayout;

	that;
};

function pictjs_at(canvasId, structureFile, layoutFile, classesFile) {
	var pictJS = PictJS(canvasId, structureFile, layoutFile, classesFile)
};

console.log('done');


