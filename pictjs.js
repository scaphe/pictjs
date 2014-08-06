
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
	var logger = libs.logger;

	// Generic functions
	function forEach(array, action) {
	  for (var i = 0; i < array.length; i++)
	    action(array[i]);
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

	function matchingLink(link) {
		return function(thing) {
			return thing.dest == link.dest && thing.src == link.src;
		};
	}


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

	function getPointLayout(pt) {
		var layout = find(that.layout.links, withId(pt.link.id))
		var linkId = pt.link.id;
		var ptName = pt.ptName;
		if ( typeof(layout) == 'undefined' ) {
			var initPt = { "x": 0, "y": 0 };
			layout = { "id": linkId, 'src': pt.link.src, 'dest': pt.link.dest };
			layout[ptName] = initPt;
			logger.info('Creating point layout of '+JSON.stringify(layout));
			that.layout.links.push(layout);
		}
		if ( typeof(layout[ptName]) == 'undefined' ) {
			logger.info('Creating point for '+ptName+' for pt '+s(pt));
			layout[ptName] = { 'x': 0, 'y': 0 };
		}
		var ans = layout[ptName];
		logger.info('Found point layout '+ptName+' ans of '+s(ans)+' from layout of '+s(layout)+' for pt '+s(pt));
		return ans;
	};

	function findShapeLayout(shape) {
		return find(that.layout.shapes, withId(shape.id));
	}

	function findLink(links, link) {
		return find(links, matchingLink(link));
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
					logger.info('Found pt of '+JSON.stringify(found));
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

	function fontFrom(fontData) {
		if ( fontData ) {
			var px = fontData.px || 20;
			var name = fontData.fontName || 'Arial';
			return { 'px': px, 'name': name, font: px+'px '+name };
		} else {
			return { 'px': 30, 'name': 'Arial', font: '30px Arial' };
		}
	}
	
	function drawShape(shape) {
		var pos = getShapePos(shape);

		ctx.strokeStyle = shape.fgColor || 'black';
		ctx.fillStyle = styleFrom(pos, shape.bgColor, 'shape');

		ctx.fillRect(pos.x,pos.y,pos.w,pos.h);
		// Draw a rect
		//		ctx.strokeStyle="#FF0000";
		ctx.strokeRect(pos.x,pos.y,pos.w,pos.h);

		// roundRect(ctx, 200,10,100,80,5, true, true);

		// Line with an arrow head
		//		drawLineArrow(ctx, 30,60, 90,120);

		// Draw some text
		ctx.fillStyle = styleFrom(pos, shape.fontColor, 'font');
		var fontData = fontFrom(shape.font);
		ctx.font = fontData.font;
		var label = shape.label || shape.id;
		var m = ctx.measureText(label);
		var fontX = pos.x + 4;
		if ( m.width < pos.w ) {
			// Centre the text horizontally
			fontX = pos.x + pos.w/2 - m.width/2;
			//logger.info('On '+shape.id+' made fontX of '+fontX+' from '+pos.x+', '+pos.w+', m='+m.width);
		}
		var fontY = pos.y+fontData.px+4;
		fontY = pos.y + pos.h/2 + fontData.px/2 - 4;
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

	function drawLink(link) {
		var fromPos = getShapeIdPos(link.src);
		var toPos = getShapeIdPos(link.dest);
		var srcPt = absolutePtCoords(link, 'srcPt', link.srcPt || { 'x': 0, 'y': 0 });
		var destPt = absolutePtCoords(link, 'destPt', link.destPt || { 'x': 0, 'y': 0 });

		if ( link.type == 'curve4' ) {
			// Draw a curvy line
			ctx.strokeStyle="black";
			var pt2 = absolutePtCoords(link, 'pt2', link.pt2 || { 'x': 40, 'y': 30 });
			var pt3 = absolutePtCoords(link, 'pt3', link.pt3 || { 'x': 40, 'y': 30 });
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
			var tension = 0.5;
			drawCurve(ctx, myPoints); //default tension=0.5
			//drawCurve(ctx, myPoints, tension);
			ctx.stroke();
			// Put an arrow on the end?
			if ( link.end == 'arrow' ) {
				var last2Pts = myPoints.slice(-4);
				logger.debug('Drawing arrow on end of curve4 at '+JSON.stringify(last2Pts));
				drawArrow(ctx, last2Pts[0], last2Pts[1], last2Pts[2], last2Pts[3]);
			}
		} else {

			// Default to 'straight'
			if ( link.end == 'arrow' ) {
				drawLineArrow(ctx, srcPt.x, srcPt.y,  destPt.x, destPt.y);
			} else {		
				// Draw a line
				ctx.beginPath();
				ctx.moveTo(srcPt.x, srcPt.y);
				ctx.lineTo(destPt.x, destPt.y);
				ctx.stroke();
			}
		}
	}

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

	function drawLinkLabels() {
		
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

	function applyDraggingPoint(action, pos) {
		var layout = getPointLayout(action.pt)
		logger.info('Got point layout of '+s(layout)+' and action of '+s(action));
		layout.x = pos.x - action.offsetPos.x;
		layout.y = pos.y - action.offsetPos.y;
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
				logger.info('Dragging point '+s(draggingPoint));
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
		if ( isMouseDown ) {
			var pos = getMousePos(canvas, e);
			mouseDragForCurrentAction(pos);
			//onsole.log('Drag at '+pos.x+', '+pos.y);
		} else {
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
					link = { 'id': link, 'dest': link, 'type': 'straight' };
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


