var canvas = document.getElementById("canvas");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the GL context
var gl = canvas.getContext("webgl");
if (!gl) {
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

window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(widthHandle, window.innerWidth);
  gl.uniform1f(heightHandle, window.innerHeight);
}

//Compile shader and combine with source
function compileShader(shaderSource, shaderType) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

//From https://codepen.io/jlfwong/pen/GqmroZ
//Utility to complain loudly if we fail to find the attribute/uniform
function getAttribLocation(program, name) {
  var attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
    throw "Cannot find attribute " + name + ".";
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  var attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === -1) {
    throw "Cannot find uniform " + name + ".";
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
  -1.0,
  1.0, // top left
  -1.0,
  -1.0, // bottom left
  1.0,
  1.0, // top right
  1.0,
  -1.0, // bottom right
]);

//Create vertex buffer
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Layout of our data in the vertex buffer
var positionHandle = getAttribLocation(program, "position");

gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(
  positionHandle,
  2, // position is a vec2 (2 values per component)
  gl.FLOAT, // each component is a float
  false, // don't normalize values
  2 * 4, // two 4 byte float components per vertex (32 bit float is 4 bytes)
  0, // how many bytes inside the buffer to start from
);

//Set uniform handle
var timeHandle = getUniformLocation(program, "time");
var widthHandle = getUniformLocation(program, "width");
var heightHandle = getUniformLocation(program, "height");

gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

var lastFrame = Date.now();
var thisFrame;

function draw() {
  //Update time
  thisFrame = Date.now();
  time += (thisFrame - lastFrame) / 1000;
  lastFrame = thisFrame;

  //Send uniforms to program
  gl.uniform1f(timeHandle, time);
  //Draw a triangle strip connecting vertices 0-4
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(draw);
}

draw();

// --- BẮT ĐẦU PHẦN LOGIC GIAO DIỆN & NHẠC ---

const modal = document.getElementsByClassName("modal");
const closeModalBtn = document.getElementsByClassName("close_modal_icon");

// --- PHẦN XỬ LÝ NHẠC CHO IPHONE (MỚI) ---
const audio = document.getElementById("player");
const startBtn = document.getElementById("startBtn");
const introOverlay = document.getElementById("intro-overlay");

// Cấu hình nhạc
audio.loop = true;
audio.volume = 0.3; // Chỉnh âm lượng (iPhone sẽ bỏ qua cái này)

// Biến kiểm tra đã phát nhạc chưa
let isAudioUnlocked = false;

// Hàm mở khóa âm thanh "thần thánh"
function unlockAudio() {
  if (isAudioUnlocked) return; // Nếu đã phát được rồi thì thôi

  // Thử phát nhạc
  audio
    .play()
    .then(() => {
      // NẾU THÀNH CÔNG (Mở khóa được)
      console.log("Đã phát nhạc thành công!");
      isAudioUnlocked = true;

      // Gỡ bỏ các sự kiện lắng nghe để web nhẹ hơn
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("scroll", unlockAudio);
    })
    .catch((error) => {
      // NẾU THẤT BẠI (Vẫn bị chặn)
      console.log("Chờ tương tác tiếp theo...");
    });
}

// 1. Xử lý nút "Mở quà" (Ưu tiên số 1)
if (startBtn) {
  startBtn.addEventListener("click", () => {
    unlockAudio();
    // Ẩn màn hình chào
    if (introOverlay) {
      introOverlay.style.opacity = "0";
      setTimeout(() => {
        introOverlay.style.display = "none";
      }, 1000);
    }
  });
}

// 2. "BẪY" SỰ KIỆN TOÀN MÀN HÌNH (Cứu cánh cho iPhone)
// Bất cứ chạm, click, hay cuộn trang nào cũng sẽ kích hoạt nhạc
document.addEventListener("touchstart", unlockAudio, { passive: false });
document.addEventListener("click", unlockAudio);
document.addEventListener("scroll", unlockAudio);

// --- PHẦN NỘI DUNG THƯ ---
const textArr = [
  {
    page: "1",
    text: "Thân gửi cục dàng iu dấu. Valentines đầu tiên của hai đứa nhưng mà mình lại không có dịp đi chơi cùng nhau, hong có buồn nghen.. Thương em lắm, hong tặng được quà cho em nên đây coi như là sự bù đắp của tui nhe hí hí :>>",
  },
  {
    page: "2",
    text: "Điều đầu tiên như mọi lần, anh muốn nói là anh yêu em nhiều lắm. Giống như em nói tui siêu may mắn khi được yêu em luôn á.. Một cô bé vừa dễ thương, vừa xinh đẹp, giỏi nữa... Nói chung là siêu siêu siêu hoàn hảo luôn ^^",
  },
  {
    page: "3",
    text: "Từ lần đầu tiên gặp em anh chưa từng nghĩ là có thể được em để ý và yêu nhiều như vậy. Anh luôn tự hỏi là “tại sao em lại yêu anh nhiều thế ?”. Em hay nói là do ảnh tử tế, nhưng mà chỉ vậy thôi thì anh nghĩ cũng chưa đủ để nhận được tình yêu của em.",
  },
  {
    page: "4",
    text: "Anh cũng muốn chia sẻ là anh đang rất là cố gắng để có thể xứng đáng với sự yêu thương đó của em. Anh hong biết là mình sẽ có thể đi được với nhau bao lâu, có thể hai đứa mình sẽ có một cái kết đẹp. Hoặc sẽ là... một hành trình đẹp.",
  },
  {
    page: "5",
    text: "Anh thật sự yêu em nhiều lắm, hong hứa gì cả vì anh sợ lắm, anh sợ nói trước bước không qua, sợ anh không làm được... Anh chỉ mong rằng là mình sẽ quên hết những điều không vui của quá khứ, yêu nhau trọn vẹn ở hiện tại và cố gắng cùng nhau tới tương lai.",
  },
  {
    page: "6",
    text: `Anh sẽ cố gắng để cục dàng không phải chờ anh quá lâu đâu. Valentines vui vẻ nha cục dàng yêu dấu của tuiii. Anh yêu em. Nợ nhau một bủi đi chơi nhá :))))
      `,
  },
];

closeModalBtn[0].onclick = () => {
  modal[0].classList.remove("modal_show");
};

// --- HÀM SAO RƠI ---
function stars() {
  let e = document.createElement("div");
  let size = Math.random() * 12;
  let duration = Math.random() * 2;

  e.setAttribute("class", "star");
  document.body.appendChild(e);

  let randomLeft = Math.random() * 65;
  let randomTop = Math.random() * 1000;
  e.style.left = randomLeft + "%";
  e.style.top = randomTop + "%" - 50;
  e.style.fontSize = 20 + size + "px";

  e.style.animationDuration = 4 + duration + "s";

  e.onclick = () => {
    const textLetter = document.getElementById("letter");
    const numPage = document.getElementById("num_page");
    const totalPage = document.getElementById("total_page");

    const prevBtn = document.getElementsByClassName("prev_btn");
    const nextBtn = document.getElementsByClassName("next_btn");

    // Đặt lại trang về 0 khi mở sao
    let count = 0;

    textLetter.innerHTML = textArr[count].text;
    numPage.innerHTML = textArr[count].page;
    totalPage.innerHTML = textArr.length;

    // Gọi hiệu ứng chữ (Đã sửa lỗi)
    textAnimation();

    // Xử lý nút Next
    nextBtn[0].onclick = () => {
      if (count < textArr.length - 1) {
        // Sửa logic: chỉ tăng nếu chưa phải trang cuối
        count++;
        textLetter.innerHTML = textArr[count].text;
        numPage.innerHTML = textArr[count].page;
        textAnimation();
      }
    };

    // Xử lý nút Prev
    prevBtn[0].onclick = () => {
      if (count > 0) {
        count--;
        textLetter.innerHTML = textArr[count].text;
        numPage.innerHTML = textArr[count].page;
        textAnimation();
      }
    };

    modal[0].classList.add("modal_show");
  };

  setTimeout(function () {
    document.body.removeChild(e);
  }, 5000);
}

setInterval(function () {
  stars();
}, 500);

// --- HÀM HIỆU ỨNG CHỮ (ĐÃ SỬA LỖI) ---
const textAnimation = () => {
  const textWrapper = document.querySelector(".ml14 .letters");

  // Lấy nội dung trực tiếp từ HTML để tránh lỗi biến
  const currentHTML = textWrapper.innerHTML;

  // Nếu có thẻ HTML (icon, img) thì KHÔNG chạy replace
  if (currentHTML.includes("<")) {
    textWrapper.innerHTML = currentHTML;
  } else {
    // Nếu là chữ thường -> chạy hiệu ứng tách chữ
    textWrapper.innerHTML = textWrapper.textContent.replace(
      /\S/g,
      "<span class='letter'>$&</span>",
    );
  }

  // Chạy Anime.js
  anime
    .timeline({ loop: false })
    .add({
      targets: ".ml14 .line",
      scaleX: [0, 1],
      opacity: [0.5, 1],
      easing: "easeInOutExpo",
      duration: 500,
    })
    .add({
      targets: ".ml14 .letter, .ml14 .letters, .icon_heart", // Thêm target để bắt cả cụm
      opacity: [0, 1],
      translateX: [40, 0],
      translateZ: 0,
      scaleX: [0.3, 1],
      easing: "easeOutExpo",
      duration: 500,
      offset: "-=600",
      delay: (el, i) => 150 + 25 * i,
    })
    .add({
      targets: ".ml14",
      opacity: 1,
      duration: 500,
      easing: "easeOutExpo",
      delay: 500,
    });
};
