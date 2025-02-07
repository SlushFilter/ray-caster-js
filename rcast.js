'use strict';

// Grid size in units.
const gridX = 16;
const gridY = 16;

// Screen Size
var vWidth = 320;
var vHeight = 240;

// Field of View
var fov = Math.PI / 2.82;

// Eye Height
var eyeHeight = 0.5;

// View Bob - Used to simulate walking.
var viewBob = 0;

// Controller!
var keyb = {
	u: false,
	d: false,
	l: false,
	r: false,
	rise: false,
	sink: false
};

// Observer object. 
var obs = {
	x:128.5,	// X coordinate
	y:128.5,	// Y coordinate
	a:0		// look angle
};

// Map Object
var map = {
	w:16,
	h:16,
	d:[]
};

// Init map object
for(var i = 0; i < map.w * map.h; i++) {
	if(Math.random() < 0.09)
		map.d[i] = 1;
	else
		map.d[i] = 0;
};
for(var x = 0; x < 16; x++) {
	map.d[x] = 2;
	map.d[x + 240] = 2;
	map.d[x * 16] = 2;
	map.d[15 + (x * 16)] = 2;
}


// Number of Viewport columns
var viewCols = vWidth;

// Ray Data Array
var rayBuffer = [];
for(var i = 0; i < viewCols; i++)
	rayBuffer[i] = { x:0, y:0, mx:0, my:0, h:false, d:0 };

// Textures
var tex = new Image();
tex.src = "tex.png";

/*
	  o : The observer object to draw.
	ctx : The rendering context
*/
function drawObserver(o, ctx) {
	var ax = (Math.cos(o.a)) * 8;
	var ay = (Math.sin(o.a)) * 8;
	
	ctx.fillStyle = "#004080";
	// Draw Map
	var i = 0;
	for(var y = 0; y < map.h; y++)
		for(var x = 0; x < map.w; x++) {
			if(map.d[i] > 0) {
				ctx.fillRect(x * 16, y * 16, 16, 16);
			}
			i++;
		}
	ctx.fillStyle = "#00FFFF";
	ctx.strokeStyle = "#FFFFFF";
	// Draw heading
	ctx.beginPath();
		ctx.moveTo(o.x, o.y);
		ctx.lineTo(o.x + ax, o.y + ay);
	ctx.stroke();
	// Draw Position
	ctx.fillRect(o.x - 1, o.y - 1, 3, 3);
};


function drawHit(o, h, ctx) {
	ctx.strokeStyle = "#FF0000";
	ctx.beginPath();
		ctx.moveTo(o.x, o.y);
		ctx.lineTo(h.x, h.y);
	ctx.stroke();
	if(h.h == true) {
		ctx.fillStyle = "#FF4080"
		ctx.fillRect((h.mx >> 0) * gridX, (h.my >> 0) * gridY, gridX, gridY);
	}
};

// Color gradiant for fun :)
var colors = [];
for(var i = 0; i < 32; i++) {
//	var c = ((256 / 64) * i) >> 0;
	colors[31 - i] = "rgba(128, 128, 128, " + ((32 - i) / 32).toString() + ")";
}

function drawCol(i, h, ctx) {

	var v = 0;
	if(h.d != 0)
		v = 256 / h.d;
	var cy = (vHeight / 2) ;//+ ((vHeight * eyeHeight) / h.d);
	cy = cy + (v * (eyeHeight - 1));
	
	var tx = ((16 * h.tex) % 256) + (h.t * 15);
	var ty = 16 * ((h.tex >> 4) >> 0);
	// Image pass
	ctx.drawImage(tex, tx, ty, 1, 15, i,  cy,  1,  v );

	// Shading pass
	var ci = (h.d >> 0) * 2;
	if (ci >= 32) ci = 31;
	ctx.fillStyle = colors[ci];
	ctx.fillRect(i, cy, 1, v);

};

// Draw floors and ceilings
function drawRow(i, ctx) {
	// Draw Ceiling
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, i, vWidth, 1);
	
	// Draw floor
	ctx.fillStyle = "#FFFFFF";
	ctx.fillRect(0, vHeight - i, vWidth, 1);
	
	var ci = ((i / 5) >> 0);
	if (ci >= 32) ci = 31;
	ctx.fillStyle = colors[ci];
	ctx.fillRect(0, vHeight - i, vWidth, 1);
};

function rotObserver(o, a) {
	o.a += a;
	if(o.a >= 2 * Math.PI)
		o.a -= (2 * Math.PI);
	if(o.a < 0)
		o.a += (2 * Math.PI);
};

function rayCast(obs, ang) {
	// Find the map cell that the observer is in.
	var obsGridX = obs.x / gridX;
	var obsGridY = obs.y / gridY; 
	 

	// the '>> 0' is a method to floor to an integer.
	var mx = obsGridX << 0;
	var my = obsGridY << 0;
	
	// Calculate the unit vector
	var nx = Math.cos(ang);
	var ny = Math.sin(ang);
		
	// Length of the ray to the next x or y intersection
	var deltaX = 0;
	var deltaY = 0;
	
	// Handle vertical and horizontal vectors.
	if(nx === 0) { deltaY = 1; }
	else if(ny === 0) { deltaY = 1; }
	else {
		var deltaX = Math.abs(1 / nx);
		var deltaY = Math.abs(1 / ny);
	}
	
	// Calc step directions and initial step for our cast.
	var stepX = 0;
	var stepY = 0;
	var iDeltaX = 0;
	var iDeltaY = 0;
	
	if(nx < 0) {
		stepX = -1;
		iDeltaX = (obsGridX - mx) * deltaX;
	} else {
		stepX = 1;
		iDeltaX = (1 - (obsGridX - mx)) * deltaX;
	}
	
	if(ny < 0) {
		stepY = -1;
		iDeltaY = (obsGridY - my) * deltaY;
	} else {
		stepY = 1;
		iDeltaY = (1 - (obsGridY - my)) * deltaY;
	}

	var hit = {
		x : 0,	// x coordinate of hit
		y : 0,  // y coordinate of hit
		mx : 0, // x grid coordinate of block
		my : 0, // y grid coordinate of block
		t : 0,  // texture offset 
		tex : 0, // texture to use for block 
		h : false // ray hit was successful?
	};
	
	var side = 0;
	while(mx >= 0 && mx < map.w && my >= 0 && my < map.h) {
		if(iDeltaX < iDeltaY) {
			iDeltaX += deltaX;
			mx += stepX;
			side = 0;
		} else {
			iDeltaY += deltaY;
			my += stepY;
			side = 1;
		}
		if(map.d[mx + (my * map.w)] > 0) {
			hit.mx = mx;
			hit.my = my;
			hit.h = true;
			hit.tex = map.d[mx + (my * map.w)] - 1;
			break;
		}
	}
	
	if(hit.h === true) {
		if(side == 0) {
			hit.x = mx;
			if(nx < 0) { hit.x = mx + 1; }
			
			var d = hit.x - obsGridX;
			hit.y = (d * (ny / nx)) + obsGridY;
			hit.d = (mx - obsGridX + (1 - stepX) / 2) / nx;
			
			hit.t = hit.y - (hit.y >> 0); // just the fractional part for texture offset.
			
		} else {
			hit.y = my;
			if(ny < 0) { hit.y = my + 1; }
			var d = hit.y - obsGridY;
			hit.x = (d * (nx / ny)) + obsGridX;
			hit.d = (my - obsGridY + (1 - stepY) / 2) / ny;
			hit.t = hit.x - (hit.x >> 0); // just the fractional part for texture offset.

		}
		
		hit.x = hit.x * gridX;
		hit.y = hit.y * gridY;
	}
	return hit;
	
};

function updateObserver() {
	
	if(keyb.u == true) {
		obs.x += Math.cos(obs.a);
		obs.y += Math.sin(obs.a);
	} else if(keyb.d == true) {
		obs.x -= Math.cos(obs.a);
		obs.y -= Math.sin(obs.a);
	}
	
	if(keyb.l == true) {
		rotObserver(obs, -0.025);
	} else if(keyb.r == true) {
		rotObserver(obs, 0.025);
	}
	
	if(keyb.rise == true) {
		eyeHeight += 0.1;
		if(eyeHeight > 1)
			eyeHeight = 1;
	}
	if(keyb.sink == true) {
		eyeHeight -= 0.1;
		if(eyeHeight < 0)
			eyeHeight = 0;
	}
};

function render(t) {
	// Update observer based on keyboard input.
	updateObserver();
	
	// Calculate rayCast
	var angStep = fov / vWidth;
	
	var a = obs.a - (fov / 2);
	var ad = -(fov / 2);
	for(var i = 0; i < vWidth; i++) {
		rayBuffer[i] = rayCast(obs, a);
		// Dewarp
		rayBuffer[i].d = rayBuffer[i].d * Math.cos(ad);
		ad += angStep;
		a += angStep;
	}
	
	// Render HUD
	var screen = document.getElementById("screen");
	var sCtx = screen.getContext("2d");
	
	var view = document.getElementById("view");
	var vCtx = view.getContext("2d");
	
	sCtx.fillStyle = "#002040";
	sCtx.fillRect(0, 0, screen.width, screen.height);

	vCtx.fillStyle = "#000810";
	vCtx.imageSmoothingEnabled = false;
	
	//vCtx.fillRect(0, 0, view.width, view.height);
	drawObserver(obs, sCtx);
	for(var i = 0; i <= vHeight / 2; i++) {
		drawRow(i, vCtx);
	}
	for(var i = 0; i < vWidth; i++) {
		drawHit(obs, rayBuffer[i], sCtx);
		drawCol(i, rayBuffer[i], vCtx);
	}

	window.requestAnimationFrame(render);
};
window.requestAnimationFrame(render);

function handleKeyUp(event) {
	switch(event.key) {
		case "w":
			keyb.u = false;
			break;
		case "s":
			keyb.d = false;
			break;
		case "a":
			keyb.l = false;
			break;
		case "d":
			keyb.r = false;
			break;
		case "r":
			keyb.rise = false;
			break;
		case "f":
			keyb.sink = false;
			break;
		default:
			break;
	}
};
window.addEventListener("keyup", handleKeyUp);

function handleKeyDown(event) {
	if(event.repeat == true) return;
	switch(event.key) {
		case "w":
			keyb.u = true;
			break;
		case "s":
			keyb.d = true;
			break;
		case "a":
			keyb.l = true;
			break;
		case "d":
			keyb.r = true;
			break;
		case "r":
			keyb.rise = true;
			break;
		case "f":
			keyb.sink = true;
			break;
		default:
			break;
	}
};
window.addEventListener("keydown", handleKeyDown);
