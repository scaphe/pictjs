
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
	that.layout = [];
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
		for (var i = 0; i < array.length; i++) {
			if ( matcher(array[i]) ) {
				found = array[i];
				break;
			}
		};
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
		var layout = find(that.layout, withId(shapeId));
		if ( layout ) {
			x = layout.x || 0;
			y = layout.y || 0;				
		}
		var pos = {"x": x, "y": y, "w":w, "h":h};
		return pos;
	};

	function getShapeLayout(shape) {
		var layout = find(that.layout, withId(shape.id))
		if ( typeof(layout) == 'undefined' ) {
			layout = {"id": shape.id, "x":0, "y":0};
			that.layout.push(layout);
		}
		return layout;
	};

	function findShapeLayout(shape) {
		return find(that.layout, withId(shape.id));
	}

	function findLink(linksTo, linkId) {
		return find(linksTo, withId(linkId));
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

	function mergedShape(shape) {
		if ( shape.classes ) {
			var index = 0;
			while ( index < shape.classes.length ) {
				var cls = shape.classes[index];
				shape = $.extend(true, {}, shape, that.classes[cls]);
				index = index + 1;
			}
		}
		return shape;
	}
	
	function drawShape(shape) {
		shape = mergedShape(shape);
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
		ctx.font = "30px Arial";
		var label = shape.label || shape.id;
		ctx.fillText(label,pos.x+4,pos.y+30+4);

		// // Underline the text, by knowing how wide it is, note font is 30px, so is 30 high
		// var m = ctx.measureText(label);
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

	function getLineEndPoint(link) {
		var toPos = getShapeIdPos(link.dest);
		return toPos;
	}

	function drawLine(fromShape, link) {
		var fromPos = getShapePos(fromShape);
		var toPos = getLineEndPoint(link);

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

	function mergedLink(shape, link) {
		var layout = findShapeLayout(shape);
		if ( layout && layout.linksTo ) {
			logger.debug('Looking for '+JSON.stringify(link)+' Found layout for shape '+shape.id+' of '+JSON.stringify(layout));
			var found = findLink(layout.linksTo, link.id);
			if ( found ) {
				logger.debug('Found link in linksTo of '+JSON.stringify(found));
				// The true means deep extend, the {} means that we don't actually change link, but clone it into {}
				link = $.extend(true, {}, link, found);
				//link.pt2 = found.pt2 || link.pt2;
				//link.pt3 = found.pt3 || link.pt3;
			}
		}
		return link;
	}

	function drawLines() {
		if ( that.structure.shapes ) {
			var len = that.structure.shapes.length
			var index = 0;
			while (index < len) {
				var shape = that.structure.shapes[index];
				if ( shape.linksTo ) {
					var linkIndex = 0;
					while ( linkIndex < shape.linksTo.length ) {
						var link = shape.linksTo[linkIndex];
						link = mergedLink(shape, link);
						logger.debug('Drawing merged link of '+JSON.stringify(link));
						drawLine(shape, link);
						linkIndex = linkIndex + 1;
					}
				}
				index = index + 1;
			}
		}			
	}

	function drawLineLabels() {
		
	}

	function redraw()
	{
		// onsole.log('in redraw');
		clearCanvas();

		drawShapes();
		drawLines();
		drawLineLabels();
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
				logger.info('Fixing link of '+JSON.stringify(link));
				if ( typeof(link) == 'string' ) {
					link = { 'id': link, 'dest': link, 'type': 'straight' };
					shape.linksTo[index] = link;
				}
				if ( typeof(link.id) == 'undefined' ) {
					link.id = link.dest;
				}
				
				index = index + 1;
			}
		}
	}

	function fixStructure() {
		var index = 0;
		while ( index < that.structure.shapes.length ) {
			var shape = that.structure.shapes[index];
			fixLinksTo(shape);
			index = index +1;
		}
	}

	// Read the structureFile and layoutFile into structure and layout
	console.log('Loading '+structureFile);

	$.getJSON( structureFile)
	    .done(function(data) {
	    	that.structure = data;
			fixStructure();
	    	console.log('Updating structure to '+JSON.stringify(that.structure));
	    	redraw();
	    })
	     .error(function() { alert("error"); });

	$.getJSON( layoutFile)
	    .done(function( data ) {
	    	that.layout = data;
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


