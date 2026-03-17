// Vercel Serverless Function — wraps the Express app built by esbuild
//
// DOMMatrix polyfill: pdfjs-dist v5 (used by pdf-parse v2) requires DOMMatrix
// at module load time; Node.js serverless runtimes don't expose it globally.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      if (!init || (Array.isArray(init) && init.length === 0)) {
        this.a=1; this.b=0; this.c=0; this.d=1; this.e=0; this.f=0;
      } else if (Array.isArray(init) && init.length === 6) {
        [this.a,this.b,this.c,this.d,this.e,this.f] = init;
      } else if (Array.isArray(init) && init.length === 16) {
        this.a=init[0]; this.b=init[1]; this.c=init[4]; this.d=init[5];
        this.e=init[12]; this.f=init[13];
      } else {
        this.a=1; this.b=0; this.c=0; this.d=1; this.e=0; this.f=0;
      }
      this.m11=this.a; this.m12=this.b; this.m13=0; this.m14=0;
      this.m21=this.c; this.m22=this.d; this.m23=0; this.m24=0;
      this.m31=0; this.m32=0; this.m33=1; this.m34=0;
      this.m41=this.e; this.m42=this.f; this.m43=0; this.m44=1;
      this.is2D=true;
      this.isIdentity=(this.a===1&&this.b===0&&this.c===0&&this.d===1&&this.e===0&&this.f===0);
    }
    multiply(o) {
      return new globalThis.DOMMatrix([
        this.a*o.a+this.b*o.c, this.a*o.b+this.b*o.d,
        this.c*o.a+this.d*o.c, this.c*o.b+this.d*o.d,
        this.e*o.a+this.f*o.c+o.e, this.e*o.b+this.f*o.d+o.f,
      ]);
    }
    translate(tx=0,ty=0) { return this.multiply(new globalThis.DOMMatrix([1,0,0,1,tx,ty])); }
    scale(sx=1,sy=sx) { return this.multiply(new globalThis.DOMMatrix([sx,0,0,sy,0,0])); }
    rotate(a) { const r=a*Math.PI/180,c=Math.cos(r),s=Math.sin(r); return this.multiply(new globalThis.DOMMatrix([c,s,-s,c,0,0])); }
    transformPoint(p) { return {x:p.x*this.a+p.y*this.c+this.e, y:p.x*this.b+p.y*this.d+this.f, z:0, w:1}; }
    inverse() {
      const det=this.a*this.d-this.b*this.c;
      if(!det) return new globalThis.DOMMatrix();
      return new globalThis.DOMMatrix([this.d/det,-this.b/det,-this.c/det,this.a/det,
        (this.c*this.f-this.d*this.e)/det,(this.b*this.e-this.a*this.f)/det]);
    }
    static fromMatrix(m) { return new globalThis.DOMMatrix([m.a??1,m.b??0,m.c??0,m.d??1,m.e??0,m.f??0]); }
    static fromFloat32Array(a) { return new globalThis.DOMMatrix(Array.from(a)); }
    static fromFloat64Array(a) { return new globalThis.DOMMatrix(Array.from(a)); }
  };
}

// NFT hint strategy: require the hints file from INSIDE artifacts/api-server/
// so Node.js resolves pdf-parse/mammoth/cookie-parser from the correct pnpm
// workspace node_modules (artifacts/api-server/node_modules/), not the root.
try { require("../artifacts/api-server/nft-hints.js"); } catch (_) {}

let appModule;
let initError;

try {
  appModule = require("../artifacts/api-server/dist/vercel.cjs");
} catch (err) {
  initError = err;
}

if (initError) {
  // Diagnostic handler: surfaces the actual crash message instead of opaque 500
  module.exports = (_req, res) => {
    res.status(500).json({
      error: "Function initialization failed",
      message: initError.message,
      stack: initError.stack,
    });
  };
} else {
  const handler = appModule.default || appModule;
  // Wrap in error-catching handler to surface request-level crashes
  module.exports = (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      res.status(500).json({
        error: "Request handler failed",
        message: err.message,
        stack: err.stack,
      });
    }
  };
}
