var canvas = document.getElementById("canvas");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the GL context
var gl = canvas.getContext('webgl');
if(!gl){
  console.error("Unable to initialize WebGL.");
}

//Time
var time = 0.0;

//************** Shader sources **************

var vertexSource = `
attribute vec2 position;
void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`;

var fragmentSource = `
precision highp float;

uniform float width;
uniform float height;
vec2 resolution = vec2(width, height);

uniform float time;

#define POINT_COUNT 8

vec2 points[POINT_COUNT];
const float speed = -0.5;
const float len = 0.25;
float intensity = 0.9;
float radius = 0.015;

//https://www.shadertoy.com/view/MlKcDD
//Signed distance to a quadratic bezier
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C){    
	vec2 a = B - A;
	vec2 b = A - 2.0*B + C;
	vec2 c = a * 2.0;
	vec2 d = A - pos;

	float kk = 1.0 / dot(b,b);
	float kx = kk * dot(a,b);
	float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
	float kz = kk * dot(d,a);      

	float res = 0.0;

	float p = ky - kx*kx;
	float p3 = p*p*p;
	float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
	float h = q*q + 4.0*p3;

	if(h >= 0.0){ 
		h = sqrt(h);
		vec2 x = (vec2(h, -h) - q) / 2.0;
		vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
		float t = uv.x + uv.y - kx;
		t = clamp( t, 0.0, 1.0 );

		// 1 root
		vec2 qos = d + (c + b*t)*t;
		res = length(qos);
	}else{
		float z = sqrt(-p);
		float v = acos( q/(p*z*2.0) ) / 3.0;
		float m = cos(v);
		float n = sin(v)*1.732050808;
		vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
		t = clamp( t, 0.0, 1.0 );

		// 3 roots
		vec2 qos = d + (c + b*t.x)*t.x;
		float dis = dot(qos,qos);
        
		res = dis;

		qos = d + (c + b*t.y)*t.y;
		dis = dot(qos,qos);
		res = min(res,dis);
		
		qos = d + (c + b*t.z)*t.z;
		dis = dot(qos,qos);
		res = min(res,dis);

		res = sqrt( res );
	}
    
	return res;
}


//http://mathworld.wolfram.com/HeartCurve.html
vec2 getHeartPosition(float t){
	return vec2(16.0 * sin(t) * sin(t) * sin(t),
							-(13.0 * cos(t) - 5.0 * cos(2.0*t)
							- 2.0 * cos(3.0*t) - cos(4.0*t)));
}

//https://www.shadertoy.com/view/3s3GDn
float getGlow(float dist, float radius, float intensity){
	return pow(radius/dist, intensity);
}

float getSegment(float t, vec2 pos, float offset, float scale){
	for(int i = 0; i < POINT_COUNT; i++){
		points[i] = getHeartPosition(offset + float(i)*len + fract(speed * t) * 6.28);
	}
    
	vec2 c = (points[0] + points[1]) / 2.0;
	vec2 c_prev;
	float dist = 10000.0;
    
	for(int i = 0; i < POINT_COUNT-1; i++){
		//https://tinyurl.com/y2htbwkm
		c_prev = c;
		c = (points[i] + points[i+1]) / 2.0;
		dist = min(dist, sdBezier(pos, scale * c_prev, scale * points[i], scale * c));
	}
	return max(0.0, dist);
}

void main(){
	vec2 uv = gl_FragCoord.xy/resolution.xy;
	float widthHeightRatio = resolution.x/resolution.y;
	vec2 centre = vec2(0.5, 0.5);
	vec2 pos = centre - uv;
	pos.y /= widthHeightRatio;
	//Shift upwards to centre heart
	pos.y += 0.02;
	float scale = 0.000015 * height;
	
	float t = time;
    
	//Get first segment
	float dist = getSegment(t, pos, 0.0, scale);
	float glow = getGlow(dist, radius, intensity);
    
	vec3 col = vec3(0.0);
    
	//White core
	col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
	//Pink glow
	col += glow * vec3(0.94,0.14,0.4);
    
	//Get second segment
	dist = getSegment(t, pos, 3.4, scale);
	glow = getGlow(dist, radius, intensity);
    
	//White core
	col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
	//Blue glow
	col += glow * vec3(0.2,0.6,1.0);
        
	//Tone mapping
	col = 1.0 - exp(-col);

	//Output to screen
 	gl_FragColor = vec4(col,1.0);
}
`;

//************** Utility functions **************

window.addEventListener('resize', onWindowResize, false);

function onWindowResize(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(widthHandle, window.innerWidth);
  gl.uniform1f(heightHandle, window.innerHeight);
}


//Compile shader and combine with source
function compileShader(shaderSource, shaderType){
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
  	throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

//From https://codepen.io/jlfwong/pen/GqmroZ
//Utility to complain loudly if we fail to find the attribute/uniform
function getAttribLocation(program, name) {
  var attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find attribute ' + name + '.';
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  var attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find uniform ' + name + '.';
  }
  return attributeLocation;
}

//************** Create shaders **************

//Create vertex and fragment shaders
var vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

//Create shader programs
var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

gl.useProgram(program);

//Set up rectangle covering entire canvas 
var vertexData = new Float32Array([
  -1.0,  1.0, 	// top left
  -1.0, -1.0, 	// bottom left
   1.0,  1.0, 	// top right
   1.0, -1.0, 	// bottom right
]);

//Create vertex buffer
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Layout of our data in the vertex buffer
var positionHandle = getAttribLocation(program, 'position');

gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle,
  2, 				// position is a vec2 (2 values per component)
  gl.FLOAT, // each component is a float
  false, 		// don't normalize values
  2 * 4, 		// two 4 byte float components per vertex (32 bit float is 4 bytes)
  0 				// how many bytes inside the buffer to start from
  );

//Set uniform handle
var timeHandle = getUniformLocation(program, 'time');
var widthHandle = getUniformLocation(program, 'width');
var heightHandle = getUniformLocation(program, 'height');

gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

var lastFrame = Date.now();
var thisFrame;

function draw(){
	
  //Update time
	thisFrame = Date.now();
  time += (thisFrame - lastFrame)/1000;	
	lastFrame = thisFrame;

	//Send uniforms to program
  gl.uniform1f(timeHandle, time);
  //Draw a triangle strip connecting vertices 0-4
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(draw);
}

draw(); 

const modal = document.getElementsByClassName('modal')
const closeModalBtn = document.getElementsByClassName('close_modal_icon')

//random
const textArr = [
	{
		page: "1",
		text: "Thân gửi cô giáo của anh. Lúc anh viết những dòng này chắc là em đã ngủ rồi. Đầu tiên anh muốn nói về mối quan hệ của tụi mình, nó được bắt đầu từ dating app. Như anh với em từng chia sẻ thì nó có khá là nhiều định kiến đối với nhiều người."
	},
	{
		page: "2",
		text: "Nhưng mà anh nghĩ, ông trời sắp đặt sự gặp gỡ nào thì cũng đều có nguyên do của nó. Ấn tượng khi date buổi đầu tiên bằng việc work và study với em nó thực sự rất là vui luôn á. Một cô bé xinh, dễ thương, hoà đồng và siêu siêu giỏi luôn."
	},
	{
		page: "3",
		text: "Anh bị hút hồn ngay từ lần gặp đầu tiên, nhưng mà anh lại suy nghĩ là chắc mình không có \"cửa\" với em đâu, lý do là gia cảnh anh cũng không phải khá giả gì, so với em thì có hơi bị chênh lệch á, nên là anh sợ mình sẽ bị \"trèo cao té đau\"."
	},
	{
		page: "4",
		text: "Nhưng mà càng ngày, khi mà tiếp xúc với em nhiều hơn, thì trong anh lại có suy nghĩ là \"À, mình muốn tìm hiểu về cô bé này nhiều hơn, muốn biết thêm về tính cách, muốn gì, thích gì, ..., đặc biệt là liệu cô bé này có thích anh hay không\"."
	},
	{
		page: "5",
		text: "Em cho anh cảm giác thoải mái, sự an toàn với những video em gửi về địa điểm em đang ở. Cho anh cảm giác cảm giác muốn được gặp em để \"dô tri\" cùng nhau, ... Trên hết là cảm giác muốn được đồng hành cùng em trên đường (đường đời) càng lâu càng tốt."
	},
	{
		page: "6",
		text: "Anh chấp nhận té đau cũng được nhưng mà nếu bỏ lỡ em thì thật sự rất là hối hận. Anh muốn dùng tất cả sự chân thành để yêu em, là điều anh duy nhất có thể làm được cho em ở thời điểm hiện tại, khi mà anh vẫn còn đang bấp bênh."
	},
	{
		page: "7",
		text: "Qua những dòng này anh muốn nói là anh thật sự rất yêu cô giáo. Anh sẽ cố gắng để cô giáo không phải chờ anh quá lâu đâu. Cùng nhau thật vui vẻ và hạnh phúc ở hiện tại cũng như tương lai nhé. Anh yêu em<i class=\"icon_heart fa-solid fa-heart\" style=\"font-size: 20px; color: #ae0001\"></i>."
	}
	// {
	// 	page: "8",
	// 	text: "<img src=\"./assets/img/demo.png\" alt=\"photo\" class=\"img\">"
	// }
]


closeModalBtn[0].onclick = () => {
    modal[0].classList.remove('modal_show')
}

function stars() {
    let e = document.createElement("div");
    let size = Math.random() * 12; // Kích thước ngẫu nhiên từ 10 đến 20
    let duration = Math.random() * 2;

    e.setAttribute("class", "star");
    document.body.appendChild(e);

    // Tính toán vị trí và kích thước phản ứng
    let randomLeft = Math.random() *55; // Tính toán vị trí theo phần trăm chiều rộng
    let randomTop = Math.random() * 1000; // Tính toán vị trí theo phần trăm chiều cao
    e.style.left = randomLeft + "%";
    e.style.top = randomTop + "%" - 50;
    e.style.fontSize = 20 + size + "px"; // Sử dụng viewport width cho kích thước

    e.style.animationDuration = 4 + duration + "s";

    e.onclick = () => {
		const textLetter = document.getElementById('letter')
		const numPage = document.getElementById('num_page')
		const totalPage = document.getElementById('total_page')

		
		//   button change page
		const prevBtn = document.getElementsByClassName('prev_btn')
		const nextBtn = document.getElementsByClassName('next_btn')

		let count = 0

		// textLetter.innerHTML = textArr[Math.floor(Math.random() * textArr.length)];
		
		textLetter.innerHTML = textArr[count].text
		numPage.innerHTML = textArr[count].page
		totalPage.innerHTML = textArr.length
		textAnimation()

		nextBtn[0].onclick = () => {
			count = count + 1
			if(count < textArr.length) {
				textLetter.innerHTML = textArr[count].text
				numPage.innerHTML = textArr[count].page
				totalPage.innerHTML = textArr.length
				textAnimation()
			} else {
				count = textArr.length - 1
			}
		} 

		prevBtn[0].onclick = () => {
			count = count - 1
			if(count < 0) {
				count = 0
			} else {
				textLetter.innerHTML = textArr[count].text
				numPage.innerHTML = textArr[count].page
				totalPage.innerHTML = textArr.length
				textAnimation()
			}
		}

		modal[0].classList.add('modal_show')
	}
  
    setTimeout(function () {
      document.body.removeChild(e);
    }, 5000);
}
  
  setInterval(function () {
    stars();
  }, 500);


const handleNextBtn = () => {
	count++;
	return count;
}
const textAnimation = () => {
	// text 
	var textWrapper = document.querySelector('.ml14 .letters');
	textWrapper.innerHTML = textWrapper.textContent.replace(/\S/g, "<span class='letter'>$&</span>");

	anime.timeline({loop: false})
		.add({
			targets: '.ml14 .line',
			scaleX: [0,1],
			opacity: [0.5,1],
			easing: "easeInOutExpo",
			duration: 500
		}).add({
			targets: '.ml14 .letter, .icon_heart',
			opacity: [0,1],
			translateX: [40,0],
			translateZ: 0,
			scaleX: [0.3, 1],
			easing: "easeOutExpo",
			duration: 500,
			offset: '-=600',
			delay: (el, i) => 150 + 25 * i
		}).add({
			targets: '.ml14',
			opacity: 1,
			duration: 500,
			easing: "easeOutExpo",
			delay: 500
		});
}