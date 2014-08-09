function createPictJsLibs() {

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

    function drawArrow(ctx, x1,y1,x2,y2) {
	var ang = Math.atan2(y2-y1,x2-x1);
	drawFilledPolygon(ctx, translateShape(rotateShape(arrow,ang),x2,y2));
    };

    function drawLineArrow(ctx, x1,y1,x2,y2) {
	ctx.beginPath();
	ctx.moveTo(x1,y1);
	ctx.lineTo(x2,y2);
	ctx.closePath();
	ctx.stroke();
	drawArrow(ctx, x1,y1,x2,y2);
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

    function drawCurve(ctx, ptsa, showPoints, tension, isClosed, numOfSegments) {
	if ( typeof(showPoints) == 'undefined' ) showPoints = true;

	ctx.beginPath();

	drawLinesForCurve(ctx, getCurvePoints(ptsa, tension, isClosed, numOfSegments));

	if (showPoints) {
	    ctx.stroke();
	    ctx.beginPath();
	    for(var i=2;i<ptsa.length-3;i+=2) 
	        ctx.fillRect(ptsa[i] - 2, ptsa[i+1] - 2, 4, 4);
	}
	ctx.stroke();
    };



    //--- End Library functions, taken off the net
    //-----------------------------------------------

    function drawLine(ctx, fx, fy, tx, ty) {
	ctx.beginPath();
	ctx.moveTo(fx, fy);
	ctx.lineTo(tx, ty);
	ctx.stroke();
    }

    function loggerLevel(level, msg) {
	console.log(level+": "+msg);
    };

    function loggerDebug(msg) {
	//loggerLevel('DEBUG', msg);
    };

    function loggerInfo(msg) {
	loggerLevel('INFO', msg);
    };

    function loggerWarn(msg) {
	loggerLevel('WARN', msg);
    };

    function loggerError(msg) {
	loggerLevel('ERROR', msg);
	alert('ERROR: '+msg);
    };

    var logger = {
	"debug": loggerDebug,
	"info": loggerInfo,
	"warn": loggerWarn,
	"error": loggerError
    };


    var functions = {
	"roundRect": roundRect,
	"drawCurve": drawCurve,
	"drawArrow":drawArrow,
	"drawLineArrow":drawLineArrow,

	"drawLine": drawLine,

	"logger": logger
    };
    return functions;
}
