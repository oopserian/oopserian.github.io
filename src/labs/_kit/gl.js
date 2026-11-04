/* 实验用的一点 WebGL2 样板：建上下文、编着色器、全屏三角形、离屏图（可以带 mipmap、深度）、从 canvas 建贴图。
   画面全在各个实验自己的着色器里；这里只是把每个实验都要写一遍的杂活收在一起，不引 Three.js 这类库（为什么见 README 的「选型」）。

     const gl = context(canvas);                         // 没有 WebGL2 就抛错，交给调用的人接
     const p = program(gl, VS, FS);                      // 着色器前面自动加 #version 300 es；顶点属性 position 在第 0 个位置
     p.use({ uTime: 1.5, uColor: [1, 0, 0], uTex: [tex, 0] });   // 按着色器里的类型设 uniform；贴图写 [贴图, 第几个单元]
     const q = fullscreen(gl); q.draw();                 // 一个盖满画面的三角形
     const t = target(gl, w, h, { mipmaps: true, depth: false });  t.bind(); …; t.mip();  // 画进离屏图，再生成 mipmap */

// 显卡是不是 CPU 在模拟（没有能用的显卡、无头浏览器）：跟首屏字符画（src/scripts/ascii.ts）同一个判断
export function softwareGL(gl) {
  let name = String(gl.getParameter(gl.RENDERER));
  if (/^webkit webgl$/i.test(name)) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  }
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** @param {HTMLCanvasElement} canvas @returns {WebGL2RenderingContext} */
export function context(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 不可用");
  return gl;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, "#version 300 es\n" + src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("着色器编不过：" + log);
  }
  return s;
}

/** 编一对着色器。返回的 use(uniforms) 切到这个程序并设 uniform，名字和类型按着色器里写的来（数组写名字不带 [0]） */
export function program(gl, vs, fs) {
  const prog = gl.createProgram(), v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(prog, v); gl.attachShader(prog, f);
  gl.bindAttribLocation(prog, 0, "position");
  gl.linkProgram(prog);
  gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("着色器连不上：" + gl.getProgramInfoLog(prog));
  // 按类型给每个 uniform 配一个设值的函数
  const set = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i), name = info.name.replace(/\[0\]$/, ""), loc = gl.getUniformLocation(prog, info.name);
    switch (info.type) {
      case gl.FLOAT: set[name] = (x) => (typeof x === "number" ? gl.uniform1f(loc, x) : gl.uniform1fv(loc, x)); break;
      case gl.FLOAT_VEC2: set[name] = (x) => gl.uniform2fv(loc, x); break;
      case gl.FLOAT_VEC3: set[name] = (x) => gl.uniform3fv(loc, x); break;
      case gl.FLOAT_VEC4: set[name] = (x) => gl.uniform4fv(loc, x); break;
      case gl.FLOAT_MAT4: set[name] = (x) => gl.uniformMatrix4fv(loc, false, x); break;
      case gl.SAMPLER_2D: set[name] = ([tex, unit]) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); }; break;
      case gl.SAMPLER_3D: set[name] = ([tex, unit]) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_3D, tex); gl.uniform1i(loc, unit); }; break;
      default: set[name] = () => {};
    }
  }
  return {
    use(uniforms = {}) {
      gl.useProgram(prog);
      for (const k in uniforms) set[k]?.(uniforms[k]);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}

/** 一个盖满画面的三角形（比两个三角形拼的方块少一条对角线上的重复像素） */
export function fullscreen(gl) {
  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); },
    dispose() { gl.deleteVertexArray(vao); gl.deleteBuffer(buf); },
  };
}

/** 一张 RGBA8 的离屏图。mipmaps：画完调 mip() 生成，取样时可以取平均；depth：带深度缓冲（画立体的网格时要） */
export function target(gl, w, h, { mipmaps = false, depth = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let rb = null;
  if (depth) {
    rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    tex, w, h,
    bind() { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); },
    mip() { gl.bindTexture(gl.TEXTURE_2D, tex); gl.generateMipmap(gl.TEXTURE_2D); },
    dispose() { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); if (rb) gl.deleteRenderbuffer(rb); },
  };
}

/** 把一张 canvas（比如画好字的图集）传成贴图，带 mipmap；canvas 重画以后再调一次 update() */
export function canvasTexture(gl, canvas) {
  const tex = gl.createTexture();
  const update = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  update();
  return { tex, update, dispose() { gl.deleteTexture(tex); } };
}
