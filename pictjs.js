
// This snippet stops odd warnings from Firefox when loading JSON files using $.getJSON
$.ajaxSetup({beforeSend: function(xhr){
  if (xhr.overrideMimeType)
  {
    xhr.overrideMimeType("application/json");
  }
}
});

var PictJS = function(canvasId, structureFile, layoutFile, classesFile) {
	var that = {};

	that.structure = {};
	that.layout = {};
	that.classes = {};
	that.actions = [];  // Undoable actions
	that.currentAction = undefined;

	

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

	function findPointAt(pos) {
		var found = undefined;
		function checkPoint(pt) {
			if ( pos.x >= pt.x-r && pos.x <= pt.x+r &&
				 pos.y >= pt.y-r && pos.y <= pt.y+r ) {
				found = found || pt;
			}
		}
		forEach(that.structure,links, function (link) {
			link = mergedLink(link);
			if ( link.type == 'curve4' ) {
				checkPoint(link.pt3);
				checkPoint(link.pt2);
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
				logger.info('Applying class of '+cls+' to '+JSON.stringify(shape));
				shape = $.extend(true, {}, shape, that.classes[cls]);
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
		shape = applyClasses(shape);
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
		link = applyClasses(link);
		var fromPos = getShapeIdPos(link.src);
		var toPos = getShapeIdPos(link.dest);

		if ( link.type == 'curve4' ) {
			// Draw a curvy line
			ctx.strokeStyle="black";
			var pt2 = link.pt2 || { 'x': 40, 'y': 30 };
			var pt3 = link.pt3 || { 'x': 40, 'y': 30 };
			var myPoints;
			if ( pt2 != pt3 ) {
				myPoints = [fromPos.x, fromPos.y,
				 pt2.x, pt2.y,
				 pt3.x, pt3.y,
				 toPos.x, toPos.y];
			} else {
				myPoints = [fromPos.x, fromPos.y,
				 pt2.x, pt2.y,
				 toPos.x, toPos.y];
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
				drawLineArrow(ctx, fromPos.x, fromPos.y,  toPos.x, toPos.y);
			} else {		
				// Draw a line
				ctx.beginPath();
				ctx.moveTo(fromPos.x, fromPos.y);
				ctx.lineTo(toPos.x, toPos.y);
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

	function mouseDragForCurrentAction(pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, pos);
			}
		}
	}

	function mouseUpForCurrentAction(pos) {
		if ( that.currentAction ) {
			var action = that.currentAction;

			if ( action.action == 'draggingShape' ) {
				applyDraggingShape(action, pos);
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
			if ( draggingShape ) {
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
				var draggingPoint = findPointAt(pos);
				if ( draggingPoint ) {
					var pointPos = getPointPos(draggingPoint);
					var offsetPos = {
						'x': pos.x-pointPos.x,
						'y': pos.y-pointPos.y
					};
					that.currentAction = {
						'action': 'draggingPoint',
						'point': draggingPoint,
						'offsetPos': offsetPos
					};
				} else {
					that.currentAction = undefined;
				}
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
			logger.info('Fixing link of '+JSON.stringify(link));
			if ( typeof(link.id) == 'undefined' ) {
				link.id = link.src+'-'+link.dest;
			}
			
			index = index + 1;
		}
	}

	function fixStructure() {
		var index = 0;
		while ( index < that.structure.shapes.length ) {
			var shape = that.structure.shapes[index];
			fixLinksTo(shape);
			index = index +1;
		}
		fixLinks();
	}

	// Read the structureFile and layoutFile into structure and layout
	console.log('Loading '+structureFile);

	$.getJSON( structureFile)
	    .done(function(data) {
	    	that.structure = data;
			fixStructure();
			daveS = that.structure;
//	    	console.log('Updating structure to '+JSON.stringify(that.structure, undefined, 2));
	    	redraw();
	    })
	     .error(function() { alert("error"); });

	$.getJSON( layoutFile)
	    .done(function( data ) {
	    	that.layout = data;
			//logger.info('Got layout of '+JSON.stringify(data));
	    	redraw();
	    });

	$.getJSON( classesFile)
	    .done(function( data ) {
	    	that.classes = data;
	    	redraw();
	    });

	dave=that;

	function showLayout() {
		var json = JSON.stringify(that.layout);
		return json;
	}

	that.showLayout = showLayout;

	that;
};

function pictjs_at(canvasId, structureFile, layoutFile, classesFile) {
	var pictJS = PictJS(canvasId, structureFile, layoutFile, classesFile)
};

console.log('done');


