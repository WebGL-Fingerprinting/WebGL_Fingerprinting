var inject = function() {
	var my_blendColor = [];
	var my_blendFactor = [1, 0];

	// 设置矩形
    function setRectangle(gl, x, y, width, height) {
        var x1 = x;
        var x2 = x + width;
        var y1 = y;
        var y2 = y + height;

        if (gl.bufferData.toString().indexOf("native code") != -1) {
            console.log('bufferData is called.');
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1,
                x2, y1,
                x1, y2,
                x1, y2,
                x2, y1,
                x2, y2,
            ]), gl.STATIC_DRAW);
        } else {
            console.log('my_glbufferData is called.');
            console.log('x1,x2,y1,y2: ', x1, x2, y1, y2);
            console.log(gl.my_glbufferData);
            gl.my_glbufferData(gl.ARRAY_BUFFER, new Float32Array([
                x1, y1,
                x2, y1,
                x1, y2,
                x1, y2,
                x2, y1,
                x2, y2,
            ]), gl.STATIC_DRAW);
        }
    }

    function setFactor(gl, location, blendFactor, blendColor) {
        if (blendFactor == gl.ZERO) {
            gl.uniform4i(location, 0, 0, 0, 0);
            console.log('setFactor: ', location, blendFactor, 0, 0, 0, 0);
        } else if (blendFactor == gl.ONE) {
            gl.uniform4i(location, 100, 100, 100, 100);
            console.log('setFactor: ', location, blendFactor, 100, 100, 100, 100);
        } else if (blendFactor == gl.CONSTANT_COLOR) {
            gl.uniform4i(location, blendColor[0], blendColor[1], blendColor[2], blendColor[3]);
            console.log('setFactor', location, blendFactor, blendColor)
        }
    }

    var newTask = function(gl, images) {
        let fsSource = `

		precision mediump float;
		// 纹理
		uniform sampler2D u_image0;     //destination
		uniform sampler2D u_image1;     //source
		
		// 从顶点着色器传入的 texCoords
		varying vec2 v_texCoord;
		uniform ivec4 sFactor;
		uniform ivec4 dFactor;
		
		uniform int gcd[256];
		
		bool check(int C, int A){
			float res = float(C)*255.0/float(A);
			res = fract(res);
			
			if(res<0.4 || res>0.6)
				return true;
			return false;
		}
		
		
		int myAbs(int a){
			if(a>0)
				return a;
			return -1*a;
		}
		
		int getDis(int A, int B){
			if(A>B)
				return A-B;
			return B-A;
		}
		
		int getMin(int A, int B){
			if(A<B)
				return A;
			return B;
		}
		
		vec4 opt(int R, int G, int B, int A){
			if(A==0)
				return vec4(0.0, 0.0, 0.0, 0.0);
			if(A == 255)
				return vec4(float(R)/255.0, float(G)/255.0, float(B)/255.0, float(A)/255.0);
		
			//判断RGB是否大于A
			bool flag_R = R<A;
			bool flag_G = G<A;
			bool flag_B = B<A;

			R = R<A? R: A;
			G = G<A? G: A;
			B = B<A? B: A;

			int tmp, n, d1=0, d2=0, d3=0, min=255*4;
		
			int best_r=255, best_g=255, best_b=255, best_a=255, best_tmp=255;
			int current_r, current_g, current_b, current_a;
			int myDis;

			//找到合适的a值
			for(int a=1;a<=255;a++){
				if(getDis(A, a) > 7)
					continue;
				
				tmp = gcd[a];
				if(flag_R){
					n = R/tmp;
					myDis = getMin(getDis(n*tmp, R), getDis((n+1)*tmp, R) );
					d1 = myDis * myDis;
				}
				if(d1>min)
					continue;
				
				if(flag_G){
					n = G/tmp;
					myDis = getMin(getDis(n*tmp, G), getDis((n+1)*tmp, G) );
					d2 = myDis * myDis;
				}
				if(d1+d2>min)
					continue;
			
				if(flag_B){
					n = B/tmp;
					myDis = getMin(getDis(n*tmp, B), getDis((n+1)*tmp, B) );
					d3 = myDis * myDis;
				}
				if(d1+d2+d3>min)
					continue;
				if(d1+d2+d3<min){
					min = d1+d2+d3;
					best_a = a;
					best_tmp = tmp;
				}else if(d1+d2+d3 == min){
					if(getDis(A, a) < getDis(A, best_a)){
						best_a = a;
						best_tmp = tmp;
					}
				}

			}

		
			//修改R
			if(flag_R){
				n = R/best_tmp;
				if(getDis(n*best_tmp, R) < getDis((n+1)*best_tmp, R)){
					best_r = n*best_tmp;
				}else{
					best_r = (n+1)*best_tmp;
				}
			}else{
				best_r = best_a;
			}
		
			//修改G
			if(flag_G){
				n = G/best_tmp;
				if(getDis(n*best_tmp, G) < getDis((n+1)*best_tmp, G)){
					best_g = n*best_tmp;
				}else{
					best_g = (n+1)*best_tmp;
				}
			}else{
				best_g = best_a;
			}
		
			//修改B
			if(flag_B){
				n = B/best_tmp;
				if(getDis(n*best_tmp, B) < getDis((n+1)*best_tmp, B)){
					best_b = n*best_tmp;
				}else{
					best_b = (n+1)*best_tmp;
				}
			}else{
				best_b = best_a;
			}

			if(best_r > best_a)
				best_r = best_a;
			if(best_g > best_a)
				best_g = best_a;
			if(best_b > best_a)
				best_b = best_a;

			return vec4(float(best_r)/255.0, float(best_g)/255.0, float(best_b)/255.0, float(best_a)/255.0);
		}
		
		//弱策略
		vec4 hillclimb(int R, int G, int B, int A){
			if(check(R,A) && check(G,A) && check(B, A)){
				return vec4(float(R)/255.0, float(G)/255.0, float(B)/255.0, float(A)/255.0);
			}
		
			int current_r, current_g, current_b, current_a;
			int r, g, b, a, min = 255*3;
			int d1, d2, d3, flag, changed;
			int best_r, best_g, best_b, best_a;
		
			changed = 0;
			for(int m=0;m<20;m++){
				if(changed==1)
					break;
		
				best_r = R + 3*m;
				best_g = G + 3*m;
				best_b = B + 3*m;
				best_a = A - 3*m;
				flag = 1;
		
				for(int n=0;n<20;n++){
					//更新当前值，重新找最优解
					if(flag == 1){
						flag = 0;
						current_r = best_r ;
						current_g = best_g ;
						current_b = best_b ;
						current_a = best_a ;
					}else{
						break;
					}
		
		
					for(int i=-1;i<2;i++){
						a = current_a + i;
						for(int j=-1;j<2;j++){
							r = current_r + j;
							if(!check(r, a))
								continue;
							d1 = myAbs(R-A+a-r);
							if(d1>min)
								continue;
							for(int k=-1;k<2;k++){
								g = current_g + k;
								if(!check(g,a))
									continue;
								d2 = myAbs(G-A+a-g);
								if(d1+d2>=min)
									continue;
								for(int l=-1;l<2;l++){
									b = current_b + l;
									if(!check(b,a))
										continue;
									d3 = myAbs(B-A+a-b);
									if(d1+d2+d3>=min)
										continue;
									min = d1+d2+d3;
									best_r = r;
									best_g = g;
									best_b = b;
									best_a = a;
		
									//找到了更优解
									flag = 1;
									changed = 1;
								}
							}
						}
					}
		
				}
			}
		//	return 	vec4(float(min)/255.0, float(min)/255.0, float(min)/255.0, float(255.0)/255.0);
			return 	vec4(float(best_r)/255.0, float(best_g)/255.0, float(best_b)/255.0, float(best_a)/255.0);
		}
		
		void main() {
			vec4 color0 = texture2D(u_image1, v_texCoord);  //
			vec4 color1 = texture2D(u_image0, v_texCoord);

			int R = int(color0.x*255.0)*sFactor.x/100;
			R = R + int(color1.x*255.0)*dFactor.x/100;
		
			int G = int(color0.y*255.0)*sFactor.y/100;
			G = G + int(color1.y*255.0)*dFactor.y/100;
		
			int B = int(color0.z*255.0)*sFactor.z/100;
			B = B + int(color1.z*255.0)*dFactor.z/100;
		
			int A = int(color0.w*255.0)*sFactor.w/100;
			A = A + int(color1.w*255.0)*dFactor.w/100;


		//	gl_FragColor = vec4(float(R)/255.0, float(G)/255.0, float(B)/255.0, float(A)/255.0);
			gl_FragColor = opt(R, G, B, A);
		//  gl_FragColor = hillclimb(R, G, B, A);
		}

		`


        let vsSource = `
    //	顶点着色器程序
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    void main() {
    // 从像素坐标转换到 0.0 到 1.0
    vec2 zeroToOne = a_position / u_resolution;

    // 再把 0->1 转换 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // 把 0->2 转换到 -1->+1 (裁剪空间)
    vec2 clipSpace = zeroToTwo - 1.0;

    //若纹理来自image标签，则y坐标要上下颠倒
    //gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    //若纹理来自readpixels读取的ArrayBuffer，则y坐标不需要上下颠倒
    gl_Position = vec4(clipSpace * vec2(1, 1), 0, 1);

    // 将纹理坐标传给片断着色器
    // GPU会在点之间进行插值
    v_texCoord = a_texCoord;
    }
    `

        //
        // 创建着色器
        //
        var vShader = gl.createShader(gl.VERTEX_SHADER);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);



        gl.shaderSource(vShader, vsSource);
        gl.shaderSource(fShader, fsSource);
        gl.compileShader(vShader);
        gl.compileShader(fShader);
        var program = gl.createProgram();
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);
        gl.validateProgram(program);
        if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
            console.error('ERROR validating program!',
                gl.getProgramInfoLog(program));
            return;
        }

        // 使用着色器程序
        gl.useProgram(program);

        // 指定从哪获取顶点数据
        var positionLocation = gl.getAttribLocation(program, "a_position");
        var texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

        // 创建缓冲区存放剪辑空间坐标
        var positionBuffer = gl.createBuffer();

        // 绑定顶点与缓冲区
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        // 设置和图片大小相同的矩形
        setRectangle(gl, 0, 0, 256, 256);

        // 为矩形提供纹理坐标
        var texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ]), gl.STATIC_DRAW);

        let textures = [];
        for (let ii = 0; ii < 2; ++ii) {
            let texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // 设置参数以便使用任意尺的影像
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

            // 上传图像到纹理
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, images[ii]);
            // 将纹理添加到纹理序列
            textures.push(texture);
        }

        // 寻找取样器的位置
        var u_image0Location = gl.getUniformLocation(program, "u_image0");
        var u_image1Location = gl.getUniformLocation(program, "u_image1");
        // 设置使用的纹理单元
        gl.uniform1i(u_image0Location, 0); // 纹理单元 0
        gl.uniform1i(u_image1Location, 1); // 纹理单元 1
        // 设置每个纹理单元对应一个纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[0]);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures[1]);

        // 指定从哪获取uniform
        var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        var sFactor = gl.getUniformLocation(program, 'sFactor');
        var dFactor = gl.getUniformLocation(program, 'dFactor');

        // 告诉WebGL如何从剪辑空间转换为像素
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 开启position属性
        gl.enableVertexAttribArray(positionLocation);

        // 将position属性与缓存区绑定
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // 告诉position属性如何从positionBuffer中获取数据
        var size = 2; // 每次迭代提取两个数据
        var type = gl.FLOAT; // 数据是 32bit 浮点型数据
        var normalize = false; // 不规范化数据
        var stride = 0; // 每次读取数据跳过0个数据
        var offset = 0; // 从缓存区的第0个数据开始读取
        gl.vertexAttribPointer(
            positionLocation, size, type, normalize, stride, offset);

        // 开启texcord 属性
        gl.enableVertexAttribArray(texcoordLocation);

        // 将texcord属性与缓冲区绑定
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

        // 告诉position属性如何从positionBuffer中获取数据
        var size = 2; // 每次迭代提取两个数据
        var type = gl.FLOAT; // 数据是 32bit 浮点型数据
        var normalize = false; // 不规范化数据
        var stride = 0; // 每次读取数据跳过0个数据
        var offset = 0; // 从缓存区的第0个数据开始读取
        gl.vertexAttribPointer(
            texcoordLocation, size, type, normalize, stride, offset);

        // 设置分辨率
        gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

	//	console.log('blendColor: ', my_blendColor);
	//	console.log('blendFactor: ', my_blendFactor);
        //设置source
        setFactor(gl, sFactor, my_blendFactor[0], my_blendColor);
        setFactor(gl, dFactor, my_blendFactor[1], my_blendColor);

		var gcd = gl.getUniformLocation(program, "gcd");
		//y[n]表示A=n, n/gcd(n,255)
		var y = [0,1,2,1,4,1,2,7,8,3,2,11,4,13,14,1,16,1,6,19,4,7,22,23,8,5,26,9,28,29,2,31,32,11,2,7,12,37,38,13,8,41,14,43,44,3,46,47,16,49,10,1,52,53,18,11,56,19,58,59,4,61,62,21,64,13,22,67,4,23,14,71,24,73,74,5,76,77,26,79,16,27,82,83,28,1,86,29,88,89,6,91,92,31,94,19,32,97,98,33,20,101,2,103,104,7,106,107,36,109,22,37,112,113,38,23,116,39,118,7,8,121,122,41,124,25,42,127,128,43,26,131,44,133,134,9,8,137,46,139,28,47,142,143,48,29,146,49,148,149,10,151,152,3,154,31,52,157,158,53,32,161,54,163,164,11,166,167,56,169,2,57,172,173,58,35,176,59,178,179,12,181,182,61,184,37,62,11,188,63,38,191,64,193,194,13,196,197,66,199,40,67,202,203,4,41,206,69,208,209,14,211,212,71,214,43,72,217,218,73,44,13,74,223,224,15,226,227,76,229,46,77,232,233,78,47,236,79,14,239,16,241,242,81,244,49,82,247,248,83,50,251,84,253,254,1];
		gl.uniform1iv(gcd, y);

        // 绘制矩形
        // gl.drawArrays是个异步操作，绘画结束之前取值会出现问题。

		var stallGPU = new Uint8Array(1 * 1 * 4);
		const startime = window.performance.now();
        gl.drawArrays(gl.TRIANGLES, 0, 6, false); //false表示直接渲染，不再进行额外处理
		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, stallGPU);
		console.log('pixel: ', stallGPU);
		const stoptime = window.performance.now();
		console.log('执行时间: ', stoptime-startime);
    }

    var config = {
        "spoof": {
            "webgl": {
				"drawElements": function(target) {
                    //可以hook clearColor
                    var proto = target.prototype ? target.prototype : target.__proto__;
                    const drawElements = proto.drawElements;
                    Object.defineProperty(proto, "drawElements", {
                        "value": function() {
						//	console.log('drawElements is called: ', arguments);
							var destination = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, destination);

                            drawElements.apply(this, arguments);

                            var source = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, source);
                            newTask(this, [destination, source]);
                        }
                    });
                },
				"blendColor": function(target) {
                    //可以hook clearColor
                    var proto = target.prototype ? target.prototype : target.__proto__;
                    const blendColor = proto.blendColor;
                    Object.defineProperty(proto, "blendColor", {
                        "value": function() {
                            my_blendColor[0] = Math.round(arguments[0]*100);
							my_blendColor[1] = Math.round(arguments[1]*100);
							my_blendColor[2] = Math.round(arguments[2]*100);
							my_blendColor[3] = Math.round(arguments[3]*100);
                        //    console.log('blendColor is called: ', my_blendColor);
                        }
                    });
                },
				"blendFunc": function(target) {
                    //可以hook clearColor
                    var proto = target.prototype ? target.prototype : target.__proto__;
                    const blendFunc = proto.blendFunc;
                    Object.defineProperty(proto, "blendFunc", {
                        "value": function() {
							my_blendFactor[0] = arguments[0];
							my_blendFactor[1] = arguments[1];
						//	console.log('blendFunc is called: ', my_blendColor);
                        }
                    });
                },
				"clear": function(target) {
                    //可以hook clear
                    //this 就是webgl渲染域(等价于gl)
                    var proto = target.prototype ? target.prototype : target.__proto__;
                    const clear = proto.clear;
                    Object.defineProperty(proto, "clear", {
                        "value": function() {
						//	console.log('clear is called: ', arguments[0]);
							clear.apply(this, arguments);
							/*
							var destination = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, destination);

                            clear.apply(this, arguments);

                            var source = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
                            this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, source);
                            newTask(this, [destination, source]);
							*/
                        }
                    });
                },
                "clearColor": function(target) {
                    //可以hook clearColor
                    var proto = target.prototype ? target.prototype : target.__proto__;
                    const clearColor = proto.clearColor;
                    Object.defineProperty(proto, "clearColor", {
                        "value": function() {
                            let clearColorRed = Math.round(arguments[0] * 255.0) / 255.0;
                            let clearColorGreen = Math.round(arguments[1] * 255.0) / 255.0;
                            let clearColorBlue = Math.round(arguments[2] * 255.0) / 255.0;
                            let clearColorAlpha = Math.round(arguments[3] * 255.0) / 255.0;

                        //    console.log('clearColor is called: ', arguments[0], arguments[1], arguments[2], arguments[3]);
                            return clearColor.apply(this, [clearColorRed, clearColorGreen, clearColorBlue, clearColorAlpha]);
                        }
                    });
                }
            }
        }
    };
    //
    config.spoof.webgl.clearColor(WebGLRenderingContext);
    config.spoof.webgl.clearColor(WebGL2RenderingContext);
    config.spoof.webgl.clear(WebGLRenderingContext);
    config.spoof.webgl.clear(WebGL2RenderingContext);
    config.spoof.webgl.blendFunc(WebGLRenderingContext);
    config.spoof.webgl.blendFunc(WebGL2RenderingContext);
	config.spoof.webgl.blendColor(WebGLRenderingContext);
    config.spoof.webgl.blendColor(WebGL2RenderingContext);
	config.spoof.webgl.drawElements(WebGLRenderingContext);
    config.spoof.webgl.drawElements(WebGL2RenderingContext);
};

var script_1 = document.createElement("script");
script_1.textContent = "(" + inject + ")()";
document.documentElement.appendChild(script_1);
script_1.remove();