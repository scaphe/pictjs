
// This snippet stops odd warnings from Firefox when loading JSON files using $.getJSON
$.ajaxSetup({beforeSend: function(xhr){
  if (xhr.overrideMimeType)
  {
    xhr.overrideMimeType("application/json");
  }
}
});



var PictJS = function(canvasId, structureFile, layoutFile) {

	var that = {};

	that.structure = {};
	that.layout = {};


	var canvas = document.getElementById(canvasId);
	var ctx = canvas.getContext("2d");
	
	/**
	* Clears the canvas.
	*/
	function clearCanvas()
	{
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

	function drawShape(shape) {

		// Create a gradient
		var grd = ctx.createLinearGradient(0,100,0,0);
		grd.addColorStop(0,"white");
		grd.addColorStop(1,"red");

		// Fill rect with gradient
		ctx.fillStyle = grd;
		ctx.fillRect(10,10,150,80);
		// Draw a rec
		ctx.strokeStyle="#FF0000";
		ctx.strokeRect(10,10,150,80);

		// Draw a line
		ctx.moveTo(0,0);
		ctx.lineTo(200,100);
		ctx.stroke();

		// Draw some text
		ctx.fillStyle='black';
		ctx.font = "30px Arial";
		var label = shape.label || shape.id;
		ctx.fillText(label,10,50);

		// Underline the text, by knowing how wide it is, note font is 30px, so is 30 high
		var m = ctx.measureText(label);
		ctx.strokeStyle="blue";
		ctx.moveTo(10,50);
		ctx.lineTo(10+m.width, 50);
		ctx.stroke();
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
	$(canvas).mousedown(function(e) {
		// Only respond to left button
		if ( e.which == 1 ) {
			isMouseDown = true;
			var pos = getMousePos(canvas, e);
			console.log('Down at '+pos.x+', '+pos.y);
		}
	});

	$(canvas).mousemove(function(e) {
		if ( isMouseDown ) {
			var pos = getMousePos(canvas, e);
			console.log('Drag at '+pos.x+', '+pos.y);
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


