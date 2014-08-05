
// This snippet stops odd warnings from Firefox when loading JSON files using $.getJSON
$.ajaxSetup({beforeSend: function(xhr){
  if (xhr.overrideMimeType)
  {
    xhr.overrideMimeType("application/json");
  }
}
});

var libs = createPictJsLibs();
var PictJS = function(canvasId, structureFile, layoutFile) {
	//-----------------------------------------------
	//--- Library functions, taken off the net

	// Arrow heads from: http://deepliquid.com/blog/archives/98
	var arrow = [
	    [ 2, 0 ],
	    [ -10, -4 ],
	    [ -10, 4]
	];

	function drawFilledPolygon(ctx, shape) {
	    ctx.beginPath();
	    ctx.moveTo(shape[0][0],shape[0][1]);

	    for(p in shape)
	        if (p > 0) ctx.lineTo(shape[p][0],shape[p][1]);

	    ctx.lineTo(shape[0][0],shape[0][1]);
	    ctx.closePath();
	    ctx.fill();
	    ctx.stroke();
	};

	function translateShape(shape,x,y) {
	    var rv = [];
	    for(p in shape)
	        rv.push([ shape[p][0] + x, shape[p][1] + y ]);
	    return rv;
	};

	function rotateShape(shape,ang)
	{
	    var rv = [];
	    for(p in shape)
	        rv.push(rotatePoint(ang,shape[p][0],shape[p][1]));
	    return rv;
	};
	function rotatePoint(ang,x,y) {
	    return [
	        (x * Math.cos(ang)) - (y * Math.sin(ang)),
	        (x * Math.sin(ang)) + (y * Math.cos(ang))
	    ];
	};

	function drawLineArrow(ctx, x1,y1,x2,y2) {
	    ctx.beginPath();
	    ctx.moveTo(x1,y1);
	    ctx.lineTo(x2,y2);
	    ctx.closePath();
	    ctx.stroke();
	    var ang = Math.atan2(y2-y1,x2-x1);
	    drawFilledPolygon(ctx, translateShape(rotateShape(arrow,ang),x2,y2));
	};


	/**
	 * From: http://js-bits.blogspot.co.uk/2010/07/canvas-rounded-corner-rectangles.html
	 * Draws a rounded rectangle using the current state of the canvas. 
	 * If you omit the last three params, it will draw a rectangle 
	 * outline with a 5 pixel border radius 
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Number} x The top left x coordinate
	 * @param {Number} y The top left y coordinate 
	 * @param {Number} width The width of the rectangle 
	 * @param {Number} height The height of the rectangle
	 * @param {Number} radius The corner radius. Defaults to 5;
	 * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
	 * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
	 */
	function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
	  if (typeof stroke == "undefined" ) {
	    stroke = true;
	  }
	  if (typeof radius === "undefined") {
	    radius = 5;
	  }
	  ctx.beginPath();
	  ctx.moveTo(x + radius, y);
	  ctx.lineTo(x + width - radius, y);
	  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	  ctx.lineTo(x + width, y + height - radius);
	  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	  ctx.lineTo(x + radius, y + height);
	  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	  ctx.lineTo(x, y + radius);
	  ctx.quadraticCurveTo(x, y, x + radius, y);
	  ctx.closePath();
	  if (stroke) {
	    ctx.stroke();
	  }
	  if (fill) {
	    ctx.fill();
	  }        
	};

	// From http://stackoverflow.com/questions/7054272/how-to-draw-smooth-curve-through-n-points-using-javascript-html5-canvas
	
	function getCurvePoints(ptsa, tension, isClosed, numOfSegments) {

	    // use input value if provided, or use a default value   
	    tension = (typeof tension != 'undefined') ? tension : 0.5;
	    isClosed = isClosed ? isClosed : false;
	    numOfSegments = numOfSegments ? numOfSegments : 16;

	    var _pts = [], res = [],    // clone array
	        x, y,           // our x,y coords
	        t1x, t2x, t1y, t2y, // tension vectors
	        c1, c2, c3, c4,     // cardinal points
	        st, t, i;       // steps based on num. of segments

	    // clone array so we don't change the original
	    _pts = ptsa.slice(0);

	    // The algorithm require a previous and next point to the actual point array.
	    // Check if we will draw closed or open curve.
	    // If closed, copy end points to beginning and first points to end
	    // If open, duplicate first points to befinning, end points to end
	    if (isClosed) {
	        _pts.unshift(ptsa[ptsa.length - 1]);
	        _pts.unshift(ptsa[ptsa.length - 2]);
	        _pts.unshift(ptsa[ptsa.length - 1]);
	        _pts.unshift(ptsa[ptsa.length - 2]);
	        _pts.push(ptsa[0]);
	        _pts.push(ptsa[1]);
	    }
	    else {
	        _pts.unshift(ptsa[1]);   //copy 1. point and insert at beginning
	        _pts.unshift(ptsa[0]);
	        _pts.push(ptsa[ptsa.length - 2]); //copy last point and append
	        _pts.push(ptsa[ptsa.length - 1]);
	    }

	    // ok, lets start..

	    // 1. loop goes through point array
	    // 2. loop goes through each segment between the 2 pts + 1e point before and after
	    for (i=2; i < (_pts.length - 4); i+=2) {
	        for (t=0; t <= numOfSegments; t++) {

	            // calc tension vectors
	            t1x = (_pts[i+2] - _pts[i-2]) * tension;
	            t2x = (_pts[i+4] - _pts[i]) * tension;

	            t1y = (_pts[i+3] - _pts[i-1]) * tension;
	            t2y = (_pts[i+5] - _pts[i+1]) * tension;

	            // calc step
	            st = t / numOfSegments;

	            // calc cardinals
	            c1 =   2 * Math.pow(st, 3)  - 3 * Math.pow(st, 2) + 1; 
	            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2); 
	            c3 =       Math.pow(st, 3)  - 2 * Math.pow(st, 2) + st; 
	            c4 =       Math.pow(st, 3)  -     Math.pow(st, 2);

	            // calc x and y cords with common control vectors
	            x = c1 * _pts[i]    + c2 * _pts[i+2] + c3 * t1x + c4 * t2x;
	            y = c1 * _pts[i+1]  + c2 * _pts[i+3] + c3 * t1y + c4 * t2y;

	            //store points in array
	            res.push(x);
	            res.push(y);

	        }
	    }

	    return res;
	};

	function drawLinesForCurve(ctx, pts) {
	    ctx.moveTo(pts[0], pts[1]);
	    for(i=2;i<pts.length-1;i+=2) ctx.lineTo(pts[i], pts[i+1]);
	};

	function drawCurve(ctx, ptsa, tension, isClosed, numOfSegments, showPoints) {
	    showPoints  = showPoints ? showPoints : true;

	    ctx.beginPath();

	    console.log('Drawing curve');
	    drawLinesForCurve(ctx, getCurvePoints(ptsa, tension, isClosed, numOfSegments));

	    if (showPoints) {
	        ctx.stroke();
	        ctx.beginPath();
	        for(var i=0;i<ptsa.length-1;i+=2) 
	                ctx.rect(ptsa[i] - 2, ptsa[i+1] - 2, 4, 4);
	    }
	};



	//--- End Library functions, taken off the net
	//-----------------------------------------------

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

	var that = {};

	that.structure = {};
	that.layout = {};


	var canvas = document.getElementById(canvasId);
	var ctx = canvas.getContext("2d");

	function getShapePos(shape) {
		var x = 0;
		var y = 0;
		var w = 200;
		var h = 100;
		if ( that.layout ) {
			var layout = find(that.layout, withId(shape.id));
			if ( layout ) {
				x = layout.x || 0;
				y = layout.y || 0;				
			}
		}
		var pos = {"x": x, "y": y, "w":w, "h":h};
		return pos;
	};

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
	
	/**
	* Clears the canvas.
	*/
	function clearCanvas()
	{
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

	function drawShape(shape) {
		var pos = getShapePos(shape);

		// Create a gradient
		var grd = ctx.createLinearGradient(pos.x,pos.y,pos.x,pos.y+pos.h);
		grd.addColorStop(0,"red");
		grd.addColorStop(1,"white");

		// Fill rect with gradient
		ctx.fillStyle = grd;
		ctx.fillRect(pos.x,pos.y,pos.w,pos.h);

		// roundRect(ctx, 200,10,100,80,5, true, true);

		// Draw a rect
		ctx.strokeStyle="#FF0000";
		ctx.strokeRect(pos.x,pos.y,pos.w,pos.h);

		// // Draw a line
	 //    ctx.beginPath();
		// ctx.moveTo(0,0);
		// ctx.lineTo(200,100);
		// ctx.stroke();

		// Line with an arrow head
		ctx.fillStyle='red';
		ctx.strokeStyle='red';
		drawLineArrow(ctx, 30,60, 90,120);

		// Draw some text
		ctx.fillStyle='black';
		ctx.font = "30px Arial";
		var label = shape.label || shape.id;
		ctx.fillText(label,pos.x+4,pos.y+30+4);

		// Draw a curvy line
		ctx.strokeStyle="black";
		var myPoints = [10,10, 40,30, 100,10, 100,50]; //minimum two points
		var tension = 0.5;

		drawCurve(ctx, myPoints); //default tension=0.5
		//drawCurve(ctx, myPoints, tension);
		ctx.stroke();

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
			console.log('drawing '+len+' boxes');
			while (index < len) {
				drawShape(that.structure.shapes[index]);
				index = index + 1;
			}
		}
	}

	function drawLines() {
		
	}

	function drawLineLabels() {
		
	}

	function redraw()
	{
		console.log('in redraw');
		// TODO: Make sure required resources are loaded before redrawing
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

	var isMouseDown = false;
	var downPos = undefined;
	var draggingShape = undefined;

	$(canvas).mousedown(function(e) {
		// Only respond to left button
		if ( e.which == 1 ) {
			isMouseDown = true;
			var pos = getMousePos(canvas, e);
			downPos = pos;

			console.log('Down at '+pos.x+', '+pos.y);
			draggingShape = findShapeAt(pos);
			if ( draggingShape ) {
				console.log('Down on shape '+draggingShape.id);
			}
		}
	});

	$(canvas).mousemove(function(e) {
		if ( isMouseDown ) {
			var pos = getMousePos(canvas, e);
			//console.log('Drag at '+pos.x+', '+pos.y);
		} else {
			// var pos = getMousePos(canvas, e);
			// console.log('Move at '+pos.x+', '+pos.y);
		}
	});

	$(window).mouseup(function(e) {
		if ( isMouseDown ) {
			isMouseDown = false;
			var pos = getMousePos(canvas, e);
			console.log('Released at '+pos.x+', '+pos.y);
			if ( draggingShape ) {
				var layout = find(that.layout, withId(draggingShape.id))
				if ( typeof(layout) == 'undefined' ) {
					layout = {"id": draggingShape.id, "x":0, "y":0};
					console.log('No layout found');
				}
				console.log('Updating layout for '+draggingShape.id);
				layout.x = layout.x + pos.x-downPos.x;
				layout.y = layout.y + pos.y-downPos.y;
				that.layout.push(layout);
				redraw();
			} else {
				console.log('Not dragging');
			}
		}
	});

	// Read the structureFile and layoutFile into structure and layout
	console.log('Loading '+structureFile);

	$.getJSON( structureFile)
	    .done(function(data) {
	    	that.structure = data;
	    	console.log('Updating structure to '+JSON.stringify(that.structure));
	    	redraw();
	    })
	     .error(function() { alert("error"); });

	$.getJSON( layoutFile)
	    .done(function( data ) {
	    	that.layout = data;
	    	redraw();
	    });

	dave=that;
	console.log('Set dave');
	that;
};

function pictjs_at(canvasId, structureFile, layoutFile) {
	var pictJS = PictJS(canvasId, structureFile, layoutFile)
};

console.log('done');


