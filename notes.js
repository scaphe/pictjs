	
	function drawTan() {
		var sz = 40;
		var x1 = 100;
		var y1 = 100;
		ctx.strokeRect(x1-sz/2, y1-sz/2, sz, sz);
		function drawTanTo(x2, y2) {
			ctx.strokeStyle = 'black';
			ctx.strokeRect(x2-sz/2, y2-sz/2, sz, sz);
			ctx.setLineWidth(5);
			ctx.strokeStyle='blue';
			drawLine(ctx, x1, y1, x2, y2);
			ctx.setLineWidth(2);

			var w1 = sz/2;
			var h1 = sz/2;

			var angle = Math.atan2(y2-y1, x2-x1);
			var tanA = Math.abs(Math.tan(angle));
			var xSign = 1; if ( Math.abs(angle) > Math.PI/2 ) xSign = -1;
			var ySign = 1; if ( angle < 0 ) ySign = -1;
			var x1dash = w1 / tanA * xSign;
			var y1dash = h1 * tanA * ySign;
			logger.info('Data is '+s({'x2':x2, 'y2':y2, 'angle': angle, 'tan': Math.tan(angle), 'x1dash':x1dash, 'y1dash':y1dash}));
			x1dash = limitAbs(x1dash, w1);
			y1dash = limitAbs(y1dash, h1);

			ctx.strokeStyle='cyan';
			drawLine(ctx, x1+x1dash, y1+y1dash, x2, y2);
			ctx.setLineWidth(1);
		}
		logger.info('-------');
		drawTanTo(230, 40);  // TR, broken, x should be +ve, y should be -ve, angle -0.43
		drawTanTo(30, 40);   // TL, works, angle -2.43
		drawTanTo(30, 240);  // broken, x should be -ve, y should be +ve, angle 2.03
		drawTanTo(200, 150); // BR, works, angle 0.46
		drawTanTo(200, 240); // BR, works, angle 0.95

		drawTanTo(x1, 240);  // B, works - angle 1.57
		drawTanTo(x1, 40);   // T, broken, y should be -ve, angle -1.57
		drawTanTo(30, y1);   // L, broken, x should be -ve, angle 3.14
		drawTanTo(200, y1);  // R, works - angle 0

//		drawTanTo(x1-100, y1-100); // TL, works, angle -2.356
//		drawTanTo(x1+100, y1-100); // TR, broken, x should be +ve, y should be -ve, angle -0.785
//		drawTanTo(x1+100, y1+100); // BR, works, angle 0.785
//		drawTanTo(x1-100, y1+100); // BL, broken, x should be -ve, y should be +ve, angle 2.356
	}
