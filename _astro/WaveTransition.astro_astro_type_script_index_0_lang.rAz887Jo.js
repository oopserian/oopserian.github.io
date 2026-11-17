import{a as e,i as t,n,r}from"./gl.B6Qi3-Xr.js";var i=8,a=720,o=950,s=80,c=9,l=.7,u=[`.`,`:`,`*`,`o`,`@`],d=27+u.length,f=Math.PI*2,p={light:{water:[`#C9D0EC`,`#9AA7E6`,`#6479E2`,`#2F4BE8`,`#1C2C99`],foam:[`#161A33`,`#2F4BE8`],cap:[`#8A97DC`,`#BCC4EC`]},dark:{water:[`#18214D`,`#283A92`,`#4B62D6`,`#8597FF`,`#C6CEFF`],foam:[`#F2F2EE`,`#AFB9FF`],cap:[`#AFB9FF`,`#FFFFFF`]}},m=`
    in vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `,h=`
    precision highp float;
    precision highp int;
    uniform sampler2D uAtlas;
    uniform vec2 uRes;          // 画布多少像素
    uniform float uDpr, uCell, uGlyph;
    uniform float uBase;        // 水面的平均高度（CSS 像素，往下是水）
    uniform float uLace;        // 退的时候页面上留的一圈沫子，0 到 1
    uniform vec3 uEdgePh;       // 水面三道起伏的相位
    uniform vec3 uBendPh;       // 浪头三道弯的相位
    uniform float uSwellPh, uChopPh, uFoamPh, uFoamDrift, uCrestOff;
    uniform float uStep;        // 沫子一秒换 12 次
    uniform vec3 uBg;
    uniform vec3 uWater[5];
    uniform vec3 uFoam[2];
    uniform vec3 uCap[2];
    out vec4 outColor;

    const float PI = 3.14159265, TAU = 6.2831853;
    const float ANGLES = ${c}.0, MAX_TILT = ${l}, FOAM_COL = 27.0, GLYPHS = ${d}.0;

    uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
    float rnd(uint a, uint b, uint c) { return float(pcg(a ^ pcg(b ^ pcg(c)))) / 4294967295.0; }
    float h1(float i) { return float(pcg(uint(int(i) + 1000000))) / 4294967295.0; }
    float vnoise(float x) { float i = floor(x), f = x - i, u = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), u); }

    float edgeAt(float x) {
      return uBase + 26.0 * sin(x * 0.0072 + uEdgePh.x) + 14.0 * sin(x * 0.019 - uEdgePh.y) + 6.0 * sin(x * 0.047 + uEdgePh.z);
    }

    // 从图集里取第 g 个字在这一格里的这一点（只要透明度，字是白的）
    float glyph(float g, vec2 local) {
      vec2 t = vec2(g * uGlyph, 0.0) + local * (uGlyph / (uCell * uDpr));
      return texture(uAtlas, t / vec2(GLYPHS * uGlyph, uGlyph)).a;
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // 设备像素，原点在左上
      float s = uCell * uDpr;
      vec2 cell = floor(p / s);
      vec2 local = p - cell * s;
      float x = cell.x * uCell, y = cell.y * uCell + uCell * 0.5;  // 这一格的位置（CSS 像素）
      float d = y - edgeAt(x);                                   // 在水下多深，负的是水面以上
      float above = uLace > 0.0 ? 90.0 : 14.0;                   // 水面以上画多远

      // 水下整片先盖上底色，比水面低一点，让沫子一半落在原来的页面上
      vec4 col = p.y / uDpr > edgeAt(p.x / uDpr) + 6.0 ? vec4(uBg, 1.0) : vec4(0.0);
      if (d < -above) { outColor = col; return; }

      float n = rnd(uint(int(cell.x) + 4096), uint(int(cell.y) + 4096), uint(uStep));
      float g = -1.0, under = -1.0;
      vec3 c = vec3(0.0), cu = vec3(0.0);

      if (d < 0.0) {
        // 水面以上：溅起的几点；退的时候页面上留一圈，越远越稀
        float pr = d > -14.0 ? 0.3 : uLace * 0.28 * (1.0 + d / above);
        if (n <= pr) { g = FOAM_COL + (n < pr * 0.3 ? 1.0 : 0.0); c = uFoam[1]; }
      } else if (d < 22.0) {
        // 浪头：一道沫子，贴着水面最浓
        float f = 1.0 - d / 22.0 + (n - 0.5) * 0.45;
        if (f >= 0.12) { g = FOAM_COL + min(4.0, floor(f * 5.0)); c = n > 0.88 ? uFoam[1] : uFoam[0]; }
      } else {
        // 水里：一道往上走的大涌，浪头按 x 弯（同一道浪头上的字都转到它的走向上），再叠一道碎浪只改亮度。
        // 不用几道方向差不多的波互相交，那样会交出一个个闭合的圈，像布纹不像海
        vec3 bf = vec3(0.0047, 0.011, 0.029), ba = vec3(30.0, 14.0, 6.0);
        vec3 bp = x * bf + uBendPh;
        float bend = dot(ba, sin(bp));
        float slope = dot(ba * bf, cos(bp));
        float ang = clamp(atan(-slope), -MAX_TILT, MAX_TILT);     // 浪头是 y + bend(x) = 常数 的一条线，走向 (1, -bend')
        float tilt = floor((ang / MAX_TILT + 1.0) * 0.5 * (ANGLES - 1.0) + 0.5);
        float ph = 0.034 * (y + bend) + uSwellPh;                  // 相位不变的地方 y 随时间变小：往上走
        float h = sin(ph) + 0.35 * sin(0.075 * (y + bend * 0.5) + 0.013 * x + uChopPh);
        // 浪尖（sin 最大）往后（下面）拖一簇沫子，梭子形：中间最浓、往后拖得最长，两头收尖；
        // 每道浪尖按 x 取一段噪声，只有几段起，一会儿冒出来一会儿散掉
        float k = floor((ph - PI * 0.5) / TAU + 0.5);
        float back = ph - PI * 0.5 - k * TAU;
        float crest = k + uCrestOff;                               // 第几道浪尖（相位取过模，加回去）
        float foam = 0.0;
        if (back > -0.35 && back < 1.9) {
          float m = vnoise(x * 0.011 + mod(crest * 7.31, 1000.0) + uFoamDrift) * (0.62 + 0.38 * sin(mod(crest * 2.3, TAU) + uFoamPh + x * 0.003));
          float st = clamp((m - 0.4) / 0.3, 0.0, 1.0);
          float len = 1.9 * st * st, lead = 0.3 * st * st;
          if (st > 0.0 && back < len && back > -lead) foam = st * (back < 0.0 ? 1.0 + back / lead : 1.0 - 0.8 * back / len) + (n - 0.5) * 0.45;
        }
        if (foam > 0.22) {
          // 沫子底下还是水：先一笔最淡的水，再盖沫子的字，不然一簇沫子在深色主题上是个黑窟窿
          under = tilt; cu = uWater[0];
          g = FOAM_COL + min(4.0, floor(1.0 + foam * 5.0)); c = foam > 0.55 ? uCap[1] : uCap[0];
        } else {
          float lv = clamp(0.5 + 0.44 * h / 1.35 + (n - 0.5) * 0.14, 0.0, 0.999);
          float kind = lv < 0.4 ? 0.0 : lv < 0.7 ? 1.0 : 2.0;
          g = kind * ANGLES + tilt; c = uWater[int(lv * 5.0)];
        }
      }
      if (under >= 0.0) { float a = glyph(under, local); col = vec4(mix(col.rgb, cu, a), max(col.a, a)); }
      if (g >= 0.0) { float a = glyph(g, local); col = vec4(mix(col.rgb, c, a), max(col.a, a)); }
      outColor = vec4(col.rgb * col.a, col.a);
    }
  `,g=document.documentElement,_=matchMedia(`(prefers-reduced-motion: reduce)`),v=matchMedia(`(prefers-color-scheme: dark)`),y=()=>(g.dataset.theme??(v.matches?`dark`:`light`))===`dark`,b=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)/255),x=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,S=null,C=null,w=0,T=0,E=1,D=``,O={},k=0,A=!1;function j(e){let t=document.createElement(`canvas`);t.width=d*e,t.height=e;let n=t.getContext(`2d`);n.strokeStyle=n.fillStyle=`#fff`,n.lineWidth=1.2*E,n.lineCap=`butt`,n.font=`${i*1.15*E}px "DM Mono", ui-monospace, monospace`,n.textAlign=`center`,n.textBaseline=`middle`;for(let t=0;t<3;t++)for(let r=0;r<c;r++){let i=(t*c+r)*e;if(n.save(),n.beginPath(),n.rect(i,0,e,e),n.clip(),n.translate(i+e/2,e/2),n.rotate((r/8*2-1)*l),n.beginPath(),t===0)n.moveTo(-e,0),n.lineTo(e,0);else if(t===1)for(let t=-e;t<=e;t+=e/8)n.lineTo(t,Math.sin(t/e*f)*e*.13);else n.moveTo(-e,-e*.16),n.lineTo(e,-e*.16),n.moveTo(-e,e*.16),n.lineTo(e,e*.16);n.stroke(),n.restore()}return u.forEach((t,r)=>n.fillText(t,(27+r)*e+e/2,e/2+E*.5)),t}function M(){if(A)return!1;if(!S){let i=document.createElement(`canvas`);i.className=`wave-canvas`,i.setAttribute(`aria-hidden`,`true`);try{let a=n(i);if(e(a)&&!window.__waveSoftwareOk)throw Error(`软件渲染`);C={gl:a,prog:t(a,m,h),quad:r(a),tex:a.createTexture()}}catch{return A=!0,C=null,!1}S=i,document.body.append(S),D=``}E=Math.min(devicePixelRatio||1,2),w=innerWidth,T=innerHeight;let a=Math.round(w*E),o=Math.round(T*E);(S.width!==a||S.height!==o)&&(S.width=a,S.height=o);let s=y(),c=`${s}-${E}`;if(c!==D){D=c;let{gl:e,tex:t}=C,n=Math.max(4,Math.round(i*E));e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,j(n)),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let r=s?p.dark:p.light;O={uBg:b(getComputedStyle(g).getPropertyValue(`--bg`).trim()||(s?`#0B0B0B`:`#F7F7F5`)),uWater:r.water.flatMap(b),uFoam:r.foam.flatMap(b),uCap:r.cap.flatMap(b),uGlyph:n}}return!0}function N(e,t=0){let{gl:n,prog:r,quad:a,tex:o}=C,s=Date.now()%1e7/1e3,c=e=>(e%f+f)%f,l=3.4*s;n.viewport(0,0,S.width,S.height),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),r.use({...O,uAtlas:[o,0],uRes:[S.width,S.height],uDpr:E,uCell:i,uBase:e,uLace:t,uStep:Math.floor(s*12)%1e6,uEdgePh:[c(1.5*s),c(2.6*s),c(4.1*s)],uBendPh:[c(.55*s),c(-.85*s+1.3),c(1.6*s+2.1)],uSwellPh:c(l),uCrestOff:Math.floor(l/f),uChopPh:c(5.6*s+2),uFoamPh:c(.9*s),uFoamDrift:.35*s%1e3}),a.draw()}function P(e,t,n){cancelAnimationFrame(k);let r=performance.now(),i=a=>{if(!M()){n?.();return}let o=e===`hold`?1:Math.min(1,(a-r)/t);if(e===`hold`)N(-80);else{let[t,n]=e===`up`?[T+s,-80]:[-80,T+s];N(t+(n-t)*x(o),e===`down`?Math.min(1,o*3)*(1-o)*1.5:0)}e===`hold`||o<1?k=requestAnimationFrame(i):n?.()};k=requestAnimationFrame(i)}var F=!1,I=0,L=()=>{cancelAnimationFrame(k),clearTimeout(I),F=!1,S?.remove(),S=null,C?.gl.getExtension(`WEBGL_lose_context`)?.loseContext(),C=null,g.removeAttribute(`data-wave`)};if(g.hasAttribute(`data-wave`)){if(_.matches||!M())g.removeAttribute(`data-wave`);else{N(-80),g.removeAttribute(`data-wave`),P(`hold`,0);let e=!1,t=()=>{e||(e=!0,P(`down`,o,L))};document.readyState===`complete`?t():(addEventListener(`load`,t,{once:!0}),setTimeout(t,300))}}document.addEventListener(`click`,e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||_.matches||A)return;let t=e.target?.closest?.(`a[href]`);if(!t||t.hasAttribute(`download`)||t.hasAttribute(`data-no-wave`)||t.target&&t.target!==`_self`)return;let n=new URL(t.href,location.href);if(n.origin!==location.origin||!/^https?:$/.test(n.protocol)||n.pathname===location.pathname&&n.search===location.search||/\.[a-z0-9]+$/i.test(n.pathname)&&!/\.html?$/i.test(n.pathname)||(e.preventDefault(),F))return;if(!M()){location.href=n.href;return}F=!0;let r=document.createElement(`link`);r.rel=`prefetch`,r.href=n.href,document.head.append(r),S.style.pointerEvents=`auto`,P(`up`,a,()=>{try{sessionStorage.setItem(`wave`,String(Date.now()))}catch{}location.href=n.href,P(`hold`,0),I=window.setTimeout(()=>{F&&P(`down`,o,L)},15e3)})}),addEventListener(`pagehide`,()=>clearTimeout(I)),addEventListener(`pageshow`,e=>{e.persisted&&S&&(clearTimeout(I),F=!1,S.style.pointerEvents=`none`,P(`down`,o,L))});