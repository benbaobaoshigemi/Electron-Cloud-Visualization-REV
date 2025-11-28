import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let runningMode = "VIDEO";
let webcamRunning = false;
const video = document.createElement("video");
video.autoplay = true;
video.playsInline = true;
video.style.display = "none";
// 必须添加到 DOM 中才能工作
document.body.appendChild(video);

let lastVideoTime = -1;
let results = undefined;
let lastHandPosition = null;
let lastPinchDistance = null;
let isModelLoading = false;
let modelLoadError = null;

// 物理/惯性相关变量
let rotationVelocity = { theta: 0, phi: 0 };
let isCoolingDown = false;
let cooldownEndTime = 0;
const FRICTION = 0.96; // 阻尼系数 (0-1)，越小停得越快
const VELOCITY_MULTIPLIER = 3.0; // 手势速度到旋转速度的转换系数 (大幅增加以提高灵敏度)
const SWIPE_THRESHOLD = 0.015; // 触发甩动的速度阈值
const MIN_VELOCITY = 0.0001; // 停止旋转的最小速度

// 创建用于绘制骨架的 Canvas
const canvasElement = document.createElement("canvas");
canvasElement.id = "gesture-canvas";
canvasElement.style.position = "absolute";
canvasElement.style.top = "0";
canvasElement.style.left = "0";
canvasElement.style.width = "100%";
canvasElement.style.height = "100%";
canvasElement.style.zIndex = "9998"; // 在 popup 下面，但在其他元素上面
canvasElement.style.pointerEvents = "none"; // 不阻挡鼠标事件
document.body.appendChild(canvasElement);
const canvasCtx = canvasElement.getContext("2d");

// 状态提示函数
function updateStatus(message, isError = false) {
    const popup = document.getElementById('gesture-status-popup');
    const text = document.getElementById('gesture-status-text');
    const indicator = document.querySelector('.status-indicator');
    
    if (popup && text) {
        popup.style.display = 'flex';
        text.innerText = message;
        if (indicator) {
            indicator.style.backgroundColor = isError ? 'red' : 'yellow';
        }
    }
    console.log(`[Gesture] ${message}`);
}

const createHandLandmarker = async () => {
  if (isModelLoading || handLandmarker) return;
  isModelLoading = true;
  modelLoadError = null;
  
  try {
      console.log("正在加载手势识别模型...");
      // 可以在界面上显示加载中
      const btn = document.getElementById('gesture-control-btn');
      if(btn) btn.title = "正在加载模型...";

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2
      });
      console.log("HandLandmarker 模型加载完成");
      isModelLoading = false;
      
      if(btn) btn.title = "手势控制";
      
  } catch (error) {
      console.error("模型加载失败:", error);
      modelLoadError = error;
      isModelLoading = false;
      updateStatus("模型加载失败，请检查网络", true);
  }
};

// 立即尝试加载
createHandLandmarker();

window.ElectronCloud = window.ElectronCloud || {};
window.ElectronCloud.Gesture = {};

window.ElectronCloud.Gesture.start = async function() {
    // 检查环境
    if (window.location.protocol === 'file:') {
        alert("错误：手势识别无法在本地文件模式(file://)下运行。\n\n请运行文件夹中的 'start_server.py' 脚本，或使用 VS Code Live Server 插件。");
        return;
    }

    if (modelLoadError) {
        alert("模型加载失败，请检查网络连接后刷新页面重试。\n" + modelLoadError.message);
        // 尝试重新加载
        createHandLandmarker();
        return;
    }

    if (!handLandmarker) {
        if (isModelLoading) {
            updateStatus("正在初始化模型，请稍候...");
            // 等待加载完成
            const checkLoad = setInterval(() => {
                if (handLandmarker) {
                    clearInterval(checkLoad);
                    window.ElectronCloud.Gesture.start();
                } else if (modelLoadError) {
                    clearInterval(checkLoad);
                    updateStatus("模型加载失败", true);
                }
            }, 500);
            return;
        } else {
            // 尝试重新加载
            await createHandLandmarker();
            if (!handLandmarker) return;
        }
    }
    
    if (webcamRunning === true) {
        return;
    }

    const constraints = {
        video: {
            width: 640,
            height: 480
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        // 显式调用 play
        video.onloadedmetadata = () => {
            video.play();
        };
        video.addEventListener("loadeddata", predictWebcam);
        webcamRunning = true;
        
        const popup = document.getElementById('gesture-status-popup');
        if(popup) {
            popup.style.display = 'flex';
            // 确保 z-index 最高
            popup.style.zIndex = '9999';
        }
        updateStatus("摄像头已启动，请展示手势");
        
        // 启动物理循环
        requestAnimationFrame(physicsLoop);
        
    } catch (err) {
        console.error("Error accessing webcam:", err);
        let msg = "无法访问摄像头。";
        if (err.name === 'NotAllowedError') {
            msg += "请允许浏览器访问摄像头权限。";
        } else if (err.name === 'NotFoundError') {
            msg += "未检测到摄像头设备。";
        } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            msg += "浏览器限制：摄像头只能在 HTTPS 或 localhost 下使用。";
        }
        alert(msg);
        updateStatus("摄像头启动失败", true);
    }
};

window.ElectronCloud.Gesture.stop = function() {
    webcamRunning = false;
    if(video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    const popup = document.getElementById('gesture-status-popup');
    if(popup) popup.style.display = 'none';
};

// 物理惯性循环
function physicsLoop() {
    if (!webcamRunning) return;

    // 如果有速度，应用旋转
    if (Math.abs(rotationVelocity.theta) > MIN_VELOCITY || Math.abs(rotationVelocity.phi) > MIN_VELOCITY) {
        handleRotation(rotationVelocity.theta, rotationVelocity.phi, true); // true 表示这是惯性更新
        
        // 应用阻尼
        rotationVelocity.theta *= FRICTION;
        rotationVelocity.phi *= FRICTION;
        
        // 速度极小时归零
        if (Math.abs(rotationVelocity.theta) < MIN_VELOCITY) rotationVelocity.theta = 0;
        if (Math.abs(rotationVelocity.phi) < MIN_VELOCITY) rotationVelocity.phi = 0;
    }

    // 检查冷却时间
    if (isCoolingDown && Date.now() > cooldownEndTime) {
        isCoolingDown = false;
    }

    requestAnimationFrame(physicsLoop);
}

async function predictWebcam() {
    if (!webcamRunning) return;
    
    try {
        // 确保视频正在播放
        if (video.paused || video.ended) {
            await video.play();
        }

        let startTimeMs = performance.now();
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            results = handLandmarker.detectForVideo(video, startTimeMs);
        }
        
        processGesture(results);
    } catch (error) {
        console.error("手势识别循环错误:", error);
        // 不要让错误中断循环，但可以稍微延迟一下避免疯狂报错
    }
    
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// 绘制手部骨架
function drawHandSkeleton(landmarksArray) {
    if (!canvasElement || !canvasCtx) return;

    // 优化：仅在尺寸变化时调整 canvas 大小
    const displayWidth = canvasElement.clientWidth;
    const displayHeight = canvasElement.clientHeight;

    if (canvasElement.width !== displayWidth || canvasElement.height !== displayHeight) {
        canvasElement.width = displayWidth;
        canvasElement.height = displayHeight;
    }
    
    // 必须清空画布，否则会有残影
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (!landmarksArray || landmarksArray.length === 0) return;

    const width = canvasElement.width;
    const height = canvasElement.height;

    // 遍历所有检测到的手
    for (const landmarks of landmarksArray) {
        // 绘制连接线
        canvasCtx.lineWidth = 3;
        
        // 判断是否捏合
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) + 
            Math.pow(thumbTip.y - indexTip.y, 2)
        );
        
        // 判断手掌朝向 (0: Wrist, 9: Middle Finger MCP)
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        const dx = middleMCP.x - wrist.x;
        const dy = middleMCP.y - wrist.y;
        
        let isHorizontal = Math.abs(dx) > Math.abs(dy);
        
        // 颜色逻辑：
        // 双手捏合 -> 黄色 (缩放)
        // 单手水平 -> 青色 (左右旋转)
        // 单手垂直 -> 紫色 (上下旋转)
        // 其他 -> 绿色
        
        if (distance < 0.1) {
            canvasCtx.strokeStyle = "#FFFF00"; // 捏合状态显示黄色
        } else {
            if (isHorizontal) {
                canvasCtx.strokeStyle = "#00FFFF"; // 水平朝向显示青色
            } else {
                canvasCtx.strokeStyle = "#FF00FF"; // 垂直朝向显示紫色
            }
        }

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // 拇指
            [0, 5], [5, 6], [6, 7], [7, 8], // 食指
            [0, 9], [9, 10], [10, 11], [11, 12], // 中指
            [0, 13], [13, 14], [14, 15], [15, 16], // 无名指
            [0, 17], [17, 18], [18, 19], [19, 20], // 小指
            [5, 9], [9, 13], [13, 17] // 手掌横向连接
        ];

        for (const [start, end] of connections) {
            const p1 = landmarks[start];
            const p2 = landmarks[end];
            
            // 绘制时镜像 X
            const x1 = (1 - p1.x) * width;
            const y1 = p1.y * height;
            const x2 = (1 - p2.x) * width;
            const y2 = p2.y * height;
            
            canvasCtx.beginPath();
            canvasCtx.moveTo(x1, y1);
            canvasCtx.lineTo(x2, y2);
            canvasCtx.stroke();
        }

        // 绘制关键点
        canvasCtx.fillStyle = "#FF0000";
        for (const landmark of landmarks) {
            const x = (1 - landmark.x) * width;
            const y = landmark.y * height;
            
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
        }
    }
}

let lockedOrientation = null; // 'HORIZONTAL' | 'VERTICAL' | null
let isSwiping = false;

function processGesture(results) {
    const popupText = document.getElementById('gesture-status-text');
    const popupIndicator = document.querySelector('.status-indicator');
    
    if (!results || !results.landmarks || results.landmarks.length === 0) {
        if(popupText) popupText.innerText = "等待手势...";
        if(popupIndicator) popupIndicator.style.backgroundColor = "red";
        
        // 清空画布
        if (canvasElement && canvasCtx) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
        
        lastHandPosition = null;
        lastPinchDistance = null;
        lockedOrientation = null;
        isSwiping = false;
        return;
    }

    if(popupIndicator) popupIndicator.style.backgroundColor = "#00ff00";

    // 绘制骨架 (传入所有手)
    drawHandSkeleton(results.landmarks);
    
    const hands = results.landmarks;
    const pinchedHands = [];

    // 找出所有处于捏合状态的手
    for (let i = 0; i < hands.length; i++) {
        const landmarks = hands[i];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) + 
            Math.pow(thumbTip.y - indexTip.y, 2)
        );

        if (distance < 0.1) {
            pinchedHands.push({
                index: i,
                x: landmarks[0].x,
                y: landmarks[0].y
            });
        }
    }

    // === 优先级 1: 双手捏合缩放 ===
    if (pinchedHands.length === 2) {
        const h1 = pinchedHands[0];
        const h2 = pinchedHands[1];
        
        const handDistance = Math.sqrt(
            Math.pow(h1.x - h2.x, 2) + 
            Math.pow(h1.y - h2.y, 2)
        );

        if (lastPinchDistance !== null) {
            const delta = handDistance - lastPinchDistance;
            
            if (Math.abs(delta) > 0.05) {
                lastPinchDistance = handDistance;
            } 
            else if (Math.abs(delta) > 0.002) {
                handleZoom(delta * 2.0);
                if(popupText) popupText.innerText = delta > 0 ? "双手中：放大" : "双手中：缩小";
            } else {
                if(popupText) popupText.innerText = "双手缩放模式";
            }
        } else {
             if(popupText) popupText.innerText = "双手缩放模式 (准备)";
        }
        
        lastPinchDistance = handDistance;
        lastHandPosition = null;
        lockedOrientation = null;
        isSwiping = false;
        return; // 缩放时不再处理旋转
    }

    // === 优先级 2: 单手捏合甩动旋转 ===
    // 逻辑：捏合 -> 快速移动 -> 松手或触发阈值 -> 惯性旋转 -> 冷却
    // 注意：两只手在画面中时禁用旋转（即使只有一只手捏合）
    if (pinchedHands.length === 1 && hands.length === 1) {
        const targetHand = pinchedHands[0];
        
        // 如果正在冷却中，忽略输入
        if (isCoolingDown) {
            if(popupText) popupText.innerText = "旋转中... (冷却)";
            lastHandPosition = targetHand; // 保持位置更新，防止冷却结束时跳变
            return;
        }

        if (lastHandPosition !== null) {
            const deltaX = targetHand.x - lastHandPosition.x;
            const deltaY = targetHand.y - lastHandPosition.y;
            
            // 计算瞬时速度
            const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // 如果速度超过阈值，触发甩动
            if (speed > SWIPE_THRESHOLD) {
                // 判断主要方向
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    // 水平甩动
                    // 速度方向：deltaX > 0 (右移) -> theta 增加 (右转)
                    rotationVelocity.theta = deltaX * VELOCITY_MULTIPLIER;
                    rotationVelocity.phi = 0;
                    if(popupText) popupText.innerText = "水平甩动！";
                } else {
                    // 垂直甩动
                    // 速度方向：deltaY > 0 (下移) -> phi 减小 (下转/上转?)
                    // 之前逻辑：deltaY < 0 (上移) -> phi 减小 (相机向上转/物体向下转)
                    // 我们希望：手向下甩 -> 物体向下转 -> 相机向上转 (phi 减小)
                    // deltaY > 0 (下移) -> phi 减小
                    rotationVelocity.phi = -deltaY * VELOCITY_MULTIPLIER;
                    rotationVelocity.theta = 0;
                    if(popupText) popupText.innerText = "垂直甩动！";
                }
                
                // 进入冷却状态，让它转一会儿
                isCoolingDown = true;
                cooldownEndTime = Date.now() + 1000; // 1秒冷却
            } else {
                if(popupText) popupText.innerText = "捏合快速甩动以旋转";
            }
        } else {
            if(popupText) popupText.innerText = "准备甩动";
        }
        
        lastHandPosition = targetHand;
        lastPinchDistance = null;
    } else {
        // === 无捏合：无操作 ===
        if (isCoolingDown) {
             if(popupText) popupText.innerText = "旋转惯性中...";
        } else {
             if(popupText) popupText.innerText = "请捏合手指以激活控制";
        }
        lastHandPosition = null;
        lastPinchDistance = null;
    }
}

function handleZoom(delta) {
    const state = window.ElectronCloud.state;
    if (!state || !state.controls || !state.camera) {
        console.warn("Gesture: State or controls not ready");
        return;
    }
    
    // 降低缩放倍率 (原 5.0 -> 1.25)
    const zoomSpeed = 1.25;
    const controls = state.controls;
    const camera = state.camera;

    // 直接操作相机距离，不依赖 controls.dollyIn/Out
    const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
    const currentDist = offset.length();
    let newDist = currentDist;

    if (delta > 0) {
        // 放大 -> 距离变小
        // delta 是正数，例如 0.01
        newDist = currentDist / (1 + delta * zoomSpeed);
    } else {
        // 缩小 -> 距离变大
        newDist = currentDist * (1 + Math.abs(delta) * zoomSpeed);
    }

    // 限制最小最大距离
    newDist = Math.max(1, Math.min(newDist, 500));

    offset.setLength(newDist);
    camera.position.copy(controls.target).add(offset);
    
    // 更新 controls 状态以同步
    controls.update();
    
    console.log(`Gesture Zoom: delta=${delta.toFixed(4)}, dist=${currentDist.toFixed(1)}->${newDist.toFixed(1)}`);
}

function handleRotation(deltaX, deltaY, isInertia = false) {
    const state = window.ElectronCloud.state;
    if (!state || !state.controls || !state.camera) {
        // console.warn("Gesture: State or controls not ready");
        return;
    }

    // 如果是惯性更新，deltaX/Y 已经是速度了，不需要再乘 rotateSpeed
    // 如果是手势直接驱动（虽然现在改成了甩动，但为了兼容性保留），则乘系数
    const speedFactor = isInertia ? 1.0 : 3.0;

    const controls = state.controls;
    const camera = state.camera;

    // 使用球坐标直接旋转相机，不依赖 controls.rotateLeft/Up
    const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    // 镜像 X：手向右移 (deltaX > 0)，相机向右转 (theta 增加)
    spherical.theta += deltaX * speedFactor;
    
    // 手向上移 (deltaY < 0)，相机向上转 (phi 减小)
    spherical.phi += deltaY * speedFactor;

    // 限制垂直角度，防止万向节死锁 (0 - PI)
    // 注意：这是球坐标的固有限制。phi=0 是正上方，phi=PI 是正下方。
    // 接近这两个极点时会出现旋转卡顿（万向节锁）。
    // 这里设置较小的边界 (0.01, PI-0.01) 以尽量减少死区。
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    // 应用回相机
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);

    // 更新 controls 状态
    controls.update();
}
