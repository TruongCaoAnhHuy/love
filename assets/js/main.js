// --- KHỞI TẠO WEBGL CANVAS (GIỮ NGUYÊN CODE CŨ) ---
var canvas = document.getElementById("canvas");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

var gl = canvas.getContext("webgl");
if (!gl) {
  console.error("Unable to initialize WebGL.");
}

var time = 0.0;

//************** Shader sources (GIỮ NGUYÊN) **************
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
    vec2 qos = d + (c + b*t)*t;
    res = length(qos);
  }else{
    float z = sqrt(-p);
    float v = acos( q/(p*z*2.0) ) / 3.0;
    float m = cos(v);
    float n = sin(v)*1.732050808;
    vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
    t = clamp( t, 0.0, 1.0 );
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

vec2 getHeartPosition(float t){
  return vec2(16.0 * sin(t) * sin(t) * sin(t),
              -(13.0 * cos(t) - 5.0 * cos(2.0*t)
              - 2.0 * cos(3.0*t) - cos(4.0*t)));
}

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
  pos.y += 0.02;
  float scale = 0.000015 * height;
  float t = time;
  float dist = getSegment(t, pos, 0.0, scale);
  float glow = getGlow(dist, radius, intensity);
  vec3 col = vec3(0.0);
  col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
  col += glow * vec3(0.94,0.14,0.4);
  dist = getSegment(t, pos, 3.4, scale);
  glow = getGlow(dist, radius, intensity);
  col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
  col += glow * vec3(0.2,0.6,1.0);
  col = 1.0 - exp(-col);
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

function compileShader(shaderSource, shaderType) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

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
var vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);
var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

var vertexData = new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]);
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
var positionHandle = getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle, 2, gl.FLOAT, false, 2 * 4, 0);

var timeHandle = getUniformLocation(program, "time");
var widthHandle = getUniformLocation(program, "width");
var heightHandle = getUniformLocation(program, "height");
gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

var lastFrame = Date.now();
var thisFrame;
function draw() {
  thisFrame = Date.now();
  time += (thisFrame - lastFrame) / 1000;
  lastFrame = thisFrame;
  gl.uniform1f(timeHandle, time);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(draw);
}
draw();

// ---------------------------------------------------------
// --- PHẦN LOGIC QUAN TRỌNG: NHẠC VÀ MỞ QUÀ ---
// ---------------------------------------------------------

const modal = document.querySelector(".modal");
const closeModalBtn = document.querySelector(".close_modal_icon");
const audio = document.getElementById("player");
const startBtn = document.getElementById("startBtn");
const introOverlay = document.getElementById("intro-overlay");

// Cấu hình nhạc
audio.loop = true;
audio.volume = 0.5;

// Hàm mở khóa âm thanh
function unlockAudio() {
  // Thử phát nhạc
  audio
    .play()
    .then(() => {
      console.log("Đã phát nhạc thành công!");
      // Nếu phát được thì gỡ sự kiện touchstart để đỡ nặng
      document.removeEventListener("touchstart", unlockAudio);
    })
    .catch((error) => {
      console.log(
        "Chưa phát được nhạc (lỗi trình duyệt chặn), đợi tương tác tiếp theo...",
      );
    });
}

// 1. KHI BẤM NÚT "MỞ QUÀ"
if (startBtn) {
  startBtn.addEventListener("click", () => {
    // Phát nhạc
    unlockAudio();

    // Ẩn màn hình chào
    if (introOverlay) {
      introOverlay.style.opacity = "0";
      // Đợi 1 giây hiệu ứng mờ rồi mới ẩn hẳn
      setTimeout(() => {
        introOverlay.style.display = "none";
      }, 1000);
    }
  });
}

// 2. BACKUP: BẮT SỰ KIỆN CHẠM MÀN HÌNH (DÀNH CHO IPHONE NẾU NÚT BẤM LỖI)
// Chỉ cần chạm vào bất cứ đâu sau khi tải trang, nhạc sẽ thử phát
document.addEventListener("touchstart", unlockAudio, { once: true });
document.addEventListener("click", unlockAudio, { once: true });

// ---------------------------------------------------------
// --- PHẦN NỘI DUNG BỨC THƯ ---
// ---------------------------------------------------------

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
    text: `Anh sẽ cố gắng để cục dàng không phải chờ anh quá lâu đâu. Valentines vui vẻ nha cục dàng yêu dấu của tuiii. Anh yêu em. Nợ nhau một bủi đi chơi nhá :))))`,
  },
];

// Nút đóng modal
closeModalBtn.onclick = () => {
  modal.classList.remove("modal_show");
};

// Hàm sao rơi + Click vào sao mở thư
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

  // SỰ KIỆN CLICK VÀO NGÔI SAO
  e.onclick = () => {
    const textLetter = document.getElementById("letter");
    const numPage = document.getElementById("num_page");
    const totalPage = document.getElementById("total_page");
    const prevBtn = document.querySelector(".prev_btn");
    const nextBtn = document.querySelector(".next_btn");

    let count = 0; // Luôn bắt đầu từ trang 1

    // Hàm cập nhật nội dung
    const updateContent = (index) => {
      textLetter.innerHTML = textArr[index].text;
      numPage.innerHTML = textArr[index].page;
      totalPage.innerHTML = textArr.length;
      textAnimation(); // Gọi hiệu ứng chữ
    };

    // Khởi tạo trang đầu
    updateContent(count);

    // Xử lý nút Next
    // Dùng onmouseup thay vì onclick để fix lỗi double click
    nextBtn.onmouseup = () => {
      if (count < textArr.length - 1) {
        count++;
        updateContent(count);
      }
    };

    // Xử lý nút Prev
    prevBtn.onmouseup = () => {
      if (count > 0) {
        count--;
        updateContent(count);
      }
    };

    // Hiện modal
    modal.classList.add("modal_show");
  };

  setTimeout(function () {
    document.body.removeChild(e);
  }, 5000);
}

setInterval(function () {
  stars();
}, 500);

// --- HÀM HIỆU ỨNG CHỮ (ANIME.JS) ---
const textAnimation = () => {
  const textWrapper = document.querySelector(".ml14 .letters");
  const currentHTML = textWrapper.innerHTML;

  // Nếu có thẻ HTML (icon, img) thì KHÔNG tách chữ
  if (currentHTML.includes("<")) {
    textWrapper.innerHTML = currentHTML;
  } else {
    // Tách chữ để tạo hiệu ứng
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
      targets: ".ml14 .letter, .ml14 .letters, .icon_heart",
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
